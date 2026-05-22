import path from "node:path";
import { clearAll, createOrder, getDb, listTransactionsForOrder, resetDb } from "../src/db.js";
import {
  resetProviderState,
  setProviderRng,
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

  console.log("Running checkout load simulation...");

  await runTrafficSpikeRetries(orderIds);

  let anomalyCount = 0;
  for (const orderId of orderIds) {
    const successes = listTransactionsForOrder(orderId).filter((t) => t.status === "success");
    if (successes.length > 1) {
      anomalyCount += 1;
      console.log(
        `order=${orderId} capture_events=${successes.length} charges=${successes.map((t) => t.chargeId).join(",")}`
      );
    }
  }

  console.log(`Processed ${orderIds.length} orders. multi_capture_orders=${anomalyCount}`);

  if (anomalyCount > 0) {
    process.exit(1);
  }
}

reproduce().catch((error) => {
  console.error(error);
  process.exit(1);
});
