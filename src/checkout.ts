import {
  getOrder,
  insertTransaction,
  listTransactionsForOrder,
  updateOrderStatus,
} from "./db.js";
import {
  charge,
  DEFAULT_PROVIDER_CONFIG,
  ProviderDeclinedError,
  ProviderTimeoutError,
  type ProviderConfig,
} from "./fakePaymentProvider.js";
import type { ChargeRequest } from "./types.js";

const MAX_CHECKOUT_ATTEMPTS = 3;

export interface CheckoutResult {
  orderId: string;
  status: "paid" | "failed";
  attempts: number;
  successfulCharges: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildChargeRequest(orderId: string): ChargeRequest {
  const order = getOrder(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }
  return {
    orderId: order.id,
    userId: order.userId,
    userName: order.userName,
    amount: order.amount,
    currency: order.currency,
  };
}

function recordAttempt(
  request: ChargeRequest,
  chargeId: string,
  status: "success" | "failed",
  errorCode: string
): void {
  insertTransaction({
    timestamp: nowIso(),
    userId: request.userId,
    userName: request.userName,
    orderId: request.orderId,
    chargeId,
    amount: request.amount,
    currency: request.currency,
    status,
    errorCode,
  });
}

export async function checkoutOrder(
  orderId: string,
  providerConfig: ProviderConfig = DEFAULT_PROVIDER_CONFIG
): Promise<CheckoutResult> {
  const order = getOrder(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  if (order.status === "paid") {
    const successes = listTransactionsForOrder(orderId).filter((t) => t.status === "success");
    return {
      orderId,
      status: "paid",
      attempts: 0,
      successfulCharges: successes.length,
    };
  }

  const request = buildChargeRequest(orderId);
  let attempts = 0;

  while (attempts < MAX_CHECKOUT_ATTEMPTS) {
    attempts += 1;
    try {
      const result = await charge(request, providerConfig);
      recordAttempt(request, result.chargeId, "success", "");
      updateOrderStatus(orderId, "paid");
      return {
        orderId,
        status: "paid",
        attempts,
        successfulCharges: listTransactionsForOrder(orderId).filter((t) => t.status === "success")
          .length,
      };
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        recordAttempt(request, error.chargeId, "success", "PROVIDER_TIMEOUT");
        updateOrderStatus(orderId, "failed");
        continue;
      }

      if (error instanceof ProviderDeclinedError) {
        recordAttempt(request, `declined_${attempts}`, "failed", error.code);
        updateOrderStatus(orderId, "failed");
        continue;
      }

      recordAttempt(request, `error_${attempts}`, "failed", "UNKNOWN");
      updateOrderStatus(orderId, "failed");
      continue;
    }
  }

  updateOrderStatus(orderId, "failed");
  const successfulCharges = listTransactionsForOrder(orderId).filter(
    (t) => t.status === "success"
  ).length;

  return {
    orderId,
    status: "failed",
    attempts,
    successfulCharges,
  };
}

export async function runCheckoutWithRetries(
  orderId: string,
  providerConfig: ProviderConfig = DEFAULT_PROVIDER_CONFIG
): Promise<CheckoutResult> {
  let result = await checkoutOrder(orderId, providerConfig);
  if (result.status === "paid") {
    return result;
  }

  result = await checkoutOrder(orderId, providerConfig);
  return result;
}
