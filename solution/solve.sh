#!/bin/bash
# Oracle solution for terminal-bench / Harbor.
# Copy to: <your-task>/solution/solve.sh
# Runs against the agent repo at /app.

set -euo pipefail

cd /app

python3 <<'PY'
from pathlib import Path

checkout = Path("src/checkout.ts")
text = checkout.read_text()

old_timeout = """      if (error instanceof ProviderTimeoutError) {
        recordAttempt(request, error.chargeId, "success", "PROVIDER_TIMEOUT");
        updateOrderStatus(orderId, "failed");
        continue;
      }"""

new_timeout = """      if (error instanceof ProviderTimeoutError) {
        recordAttempt(request, error.chargeId, "success", "PROVIDER_TIMEOUT");
        updateOrderStatus(orderId, "paid");
        const successes = listTransactionsForOrder(orderId).filter(
          (t) => t.status === "success"
        );
        return {
          orderId,
          status: "paid",
          attempts,
          successfulCharges: successes.length,
        };
      }"""

if old_timeout not in text:
    raise SystemExit("checkout.ts timeout block not found; already patched?")

text = text.replace(old_timeout, new_timeout, 1)

guard = """  const request = buildChargeRequest(orderId);
  let attempts = 0;"""

guard_replacement = """  const request = buildChargeRequest(orderId);

  const priorSuccesses = listTransactionsForOrder(orderId).filter(
    (t) => t.status === "success"
  );
  if (priorSuccesses.length > 0) {
    updateOrderStatus(orderId, "paid");
    return {
      orderId,
      status: "paid",
      attempts: 0,
      successfulCharges: priorSuccesses.length,
    };
  }

  let attempts = 0;"""

if guard not in text:
    raise SystemExit("checkout.ts charge loop anchor not found")

text = text.replace(guard, guard_replacement, 1)
checkout.write_text(text)
print("Patched src/checkout.ts")
PY

npm run refunds
npm test
npm run reproduce

echo "Oracle solution completed."
