import { classifyProviderFailure } from "./chargeFailure.js";
import {
  getOrder,
  insertTransaction,
  listTransactionsForOrder,
  updateOrderStatus,
} from "./db.js";
import {
  DEFAULT_PROVIDER_CONFIG,
  type ProviderConfig,
} from "./fakePaymentProvider.js";
import { submitCharge } from "./providerClient.js";
import { maxInProcessAttempts } from "./retryPolicy.js";
import type { ChargeRequest } from "./types.js";

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

function paidResult(orderId: string, attempts: number): CheckoutResult {
  const successes = listTransactionsForOrder(orderId).filter((t) => t.status === "success");
  return {
    orderId,
    status: "paid",
    attempts,
    successfulCharges: successes.length,
  };
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
    return paidResult(orderId, 0);
  }

  const request = buildChargeRequest(orderId);
  let attempts = 0;
  const attemptLimit = maxInProcessAttempts();

  while (attempts < attemptLimit) {
    attempts += 1;
    try {
      const result = await submitCharge(request, providerConfig);
      recordAttempt(request, result.chargeId, "success", "");
      updateOrderStatus(orderId, "paid");
      return paidResult(orderId, attempts);
    } catch (error) {
      const failure = classifyProviderFailure(error, attempts);
      recordAttempt(
        request,
        failure.chargeId,
        failure.recordStatus,
        failure.errorCode
      );

      if (failure.disposition === "settled") {
        updateOrderStatus(orderId, "paid");
        return paidResult(orderId, attempts);
      }

      updateOrderStatus(orderId, "failed");
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
