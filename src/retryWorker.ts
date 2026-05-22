import { checkoutOrder } from "./checkout.js";
import { listPendingOrders } from "./db.js";
import {
  DEFAULT_PROVIDER_CONFIG,
  SPIKE_PROVIDER_CONFIG,
  type ProviderConfig,
} from "./fakePaymentProvider.js";
export interface RetryWorkerSummary {
  processed: number;
  paid: number;
  failed: number;
  duplicateChargeOrders: string[];
}

export async function processRetryQueue(
  providerConfig: ProviderConfig = DEFAULT_PROVIDER_CONFIG
): Promise<RetryWorkerSummary> {
  const pending = listPendingOrders();
  const summary: RetryWorkerSummary = {
    processed: 0,
    paid: 0,
    failed: 0,
    duplicateChargeOrders: [],
  };

  for (const order of pending) {
    const before = order.id;
    const result = await checkoutOrder(before, providerConfig);
    summary.processed += 1;

    if (result.status === "paid") {
      summary.paid += 1;
      if (result.successfulCharges > 1) {
        summary.duplicateChargeOrders.push(result.orderId);
      }
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}

export async function runTrafficSpikeRetries(
  orderIds: string[]
): Promise<RetryWorkerSummary> {
  const summary: RetryWorkerSummary = {
    processed: 0,
    paid: 0,
    failed: 0,
    duplicateChargeOrders: [],
  };

  await Promise.all(
    orderIds.map(async (orderId) => {
      const result = await checkoutOrder(orderId, SPIKE_PROVIDER_CONFIG);
      summary.processed += 1;
      if (result.status === "paid") {
        summary.paid += 1;
      } else {
        summary.failed += 1;
      }
    })
  );

  await processRetryQueue(SPIKE_PROVIDER_CONFIG);

  for (const orderId of orderIds) {
    const { listTransactionsForOrder } = await import("./db.js");
    const successes = listTransactionsForOrder(orderId).filter((t) => t.status === "success");
    if (successes.length > 1) {
      summary.duplicateChargeOrders.push(orderId);
    }
  }

  return summary;
}
