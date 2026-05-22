import path from "node:path";
import { checkoutOrder } from "../src/checkout.js";
import { clearAll, createOrder, getDb, listTransactionsForOrder, resetDb } from "../src/db.js";
import {
  resetProviderState,
  setProviderRng,
  SPIKE_PROVIDER_CONFIG,
} from "../src/fakePaymentProvider.js";
import { runTrafficSpikeRetries } from "../src/retryWorker.js";
import type { Order } from "../src/types.js";

const DB_PATH = path.join(process.cwd(), "data", "reproduce.db");

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function seedOrders(): string[] {
  clearAll();
  const orders: Order[] = Array.from({ length: 12 }, (_, i) => ({
    id: `ord_spike_${i + 1}`,
    userId: `u_${200 + i}`,
    userName: `Customer ${i + 1}`,
    amount: 29.99 + (i % 3) * 10,
    currency: "USD",
    status: "pending",
    createdAt: new Date().toISOString(),
  }));

  for (const order of orders) {
    createOrder(order);
  }

  return orders.map((o) => o.id);
}

async function reproduce(): Promise<void> {
  resetDb();
  getDb(DB_PATH);
  resetProviderState();
  setProviderRng(seededRandom(20251011));

  const orderIds = seedOrders();

  console.log("Simulating traffic spike (10:00–11:00 window)...");
  console.log("Provider timeout-after-charge rate elevated.\n");

  await runTrafficSpikeRetries(orderIds);

  for (const orderId of orderIds) {
    const txns = listTransactionsForOrder(orderId);
    const successes = txns.filter((t) => t.status === "success");
    if (successes.length > 1) {
      console.log(
        `[DUPLICATE] order=${orderId} successful_charges=${successes.length} charge_ids=${successes.map((t) => t.chargeId).join(", ")}`
      );
    }
  }

  const duplicateOrders = orderIds.filter((orderId) => {
    const successes = listTransactionsForOrder(orderId).filter((t) => t.status === "success");
    return successes.length > 1;
  });

  console.log(`\nProcessed ${orderIds.length} orders during spike.`);
  console.log(`Orders with duplicate successful charges: ${duplicateOrders.length}`);

  if (duplicateOrders.length === 0) {
    console.log("No duplicates this run; re-run or widen spike window.");
  }
}

reproduce().catch((error) => {
  console.error(error);
  process.exit(1);
});
