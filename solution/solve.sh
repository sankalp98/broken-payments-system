#!/bin/bash
# Updated oracle for harder bug (chargeFailure classification).
# Copy to Harbor task only — do not commit to agent-facing repo.

set -euo pipefail

cd /app

python3 <<'PY'
from pathlib import Path

charge_failure = Path("src/chargeFailure.ts")
text = charge_failure.read_text()

old = """    if (error.code === "GATEWAY_TIMEOUT" && error.chargeId) {
      return {
        disposition: "retry",
        recordStatus: "success",
        chargeId: error.chargeId,
        errorCode: error.code,
      };
    }"""

new = """    if (error.code === "GATEWAY_TIMEOUT" && error.chargeId) {
      return {
        disposition: "settled",
        recordStatus: "success",
        chargeId: error.chargeId,
        errorCode: error.code,
      };
    }"""

if old not in text:
    raise SystemExit("chargeFailure.ts GATEWAY_TIMEOUT block not found")

charge_failure.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Patched src/chargeFailure.ts")

checkout = Path("src/checkout.ts")
ctext = checkout.read_text()
guard = """  const request = buildChargeRequest(orderId);
  let attempts = 0;"""
guard_replacement = """  const request = buildChargeRequest(orderId);

  const priorSuccesses = listTransactionsForOrder(orderId).filter(
    (t) => t.status === "success"
  );
  if (priorSuccesses.length > 0) {
    updateOrderStatus(orderId, "paid");
    return paidResult(orderId, 0);
  }

  let attempts = 0;"""

if guard in ctext:
    checkout.write_text(ctext.replace(guard, guard_replacement, 1), encoding="utf-8")
    print("Patched src/checkout.ts")
PY

npm run refunds
npm test
npm run reproduce

echo "Oracle solution completed."
