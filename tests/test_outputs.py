"""
Verifier for broken-payments-system terminal-bench task.
Harbor runs this via tests/test.sh after the agent finishes.

NOTE: This file is for task grading only. Remove from the public/agent-facing
repo before running the benchmark so the model cannot read the rubric.
"""

from __future__ import annotations

import csv
import re
import subprocess
from collections import defaultdict
from pathlib import Path

import pytest

REPO = Path("/app") if Path("/app").exists() else Path(__file__).resolve().parent.parent
TRANSACTIONS = REPO / "data" / "transactions_10_11.csv"
REFUND_REPORT = REPO / "data" / "refund_report.csv"


def run(cmd: list[str], timeout: int = 180) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=REPO,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def load_transactions(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def compute_expected_refunds(transactions: list[dict[str, str]]) -> dict[tuple[str, str], float]:
    """Per order_id: keep earliest success; refund extras. Group by (user_id, currency)."""
    by_order: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in transactions:
        if row["status"] == "success":
            by_order[row["order_id"]].append(row)

    grouped: dict[tuple[str, str], float] = defaultdict(float)
    for charges in by_order.values():
        if len(charges) <= 1:
            continue
        charges.sort(key=lambda r: r["timestamp"])
        for extra in charges[1:]:
            key = (extra["user_id"], extra["currency"])
            grouped[key] += float(extra["amount"])
    return dict(grouped)


def parse_refund_report(path: Path) -> dict[tuple[str, str], float]:
    assert path.exists(), f"Missing refund report: {path}"
    with path.open(newline="") as f:
        rows = list(csv.DictReader(f))
    result: dict[tuple[str, str], float] = {}
    for row in rows:
        key = (row["user_id"], row["currency"])
        result[key] = float(row["refund_amount"])
    return result


def test_npm_unit_tests_pass() -> None:
    proc = run(["npm", "test"])
    assert proc.returncode == 0, f"npm test failed:\n{proc.stdout}\n{proc.stderr}"


def test_reproduce_shows_no_duplicate_charges() -> None:
    proc = run(["npm", "run", "reproduce"], timeout=180)
    assert proc.returncode == 0, f"npm run reproduce failed:\n{proc.stderr}"
    assert "[DUPLICATE]" not in proc.stdout, (
        "Duplicate successful charges still detected:\n" + proc.stdout
    )


def test_retries_not_disabled_in_checkout() -> None:
    checkout = (REPO / "src" / "checkout.ts").read_text()
    retry = (REPO / "src" / "retryWorker.ts").read_text()

    assert "MAX_CHECKOUT_ATTEMPTS" in checkout or "attempts" in checkout
    assert not re.search(r"MAX_CHECKOUT_ATTEMPTS\s*=\s*0", checkout)
    assert not re.search(r"disable.*retr", checkout, re.I)
    assert "processRetryQueue" in retry or "runTrafficSpikeRetries" in retry


def test_refund_report_exists() -> None:
    assert REFUND_REPORT.exists()


def test_refund_report_matches_expected_totals() -> None:
    transactions = load_transactions(TRANSACTIONS)
    expected = compute_expected_refunds(transactions)
    actual = parse_refund_report(REFUND_REPORT)

    assert set(actual.keys()) == set(expected.keys()), (
        f"Refund keys mismatch.\nexpected: {sorted(expected)}\nactual: {sorted(actual)}"
    )
    for key, exp_amount in expected.items():
        assert abs(actual[key] - exp_amount) < 0.01, (
            f"Refund amount mismatch for {key}: expected {exp_amount}, got {actual[key]}"
        )


def test_refund_report_no_false_positive_users() -> None:
    actual = parse_refund_report(REFUND_REPORT)
    false_positive_users = {"u_201", "u_601", "u_602"}
    for user_id, _currency in actual.keys():
        assert user_id not in false_positive_users, (
            f"False positive refund for legitimate multi-order user {user_id}"
        )


def test_refund_report_has_expected_duplicate_victims() -> None:
    actual = parse_refund_report(REFUND_REPORT)
    assert ("u_401", "USD") in actual
    assert abs(actual[("u_401", "USD")] - 89.00) < 0.01
    assert ("u_501", "USD") in actual
    assert abs(actual[("u_501", "USD")] - 129.00) < 0.01


def test_refund_report_line_count() -> None:
    with REFUND_REPORT.open(newline="") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 21, f"Expected 21 refund lines, got {len(rows)}"
