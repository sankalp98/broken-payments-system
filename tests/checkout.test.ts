import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkoutOrder, runCheckoutWithRetries } from "../src/checkout.js";
import { clearAll, createOrder, getDb, listTransactionsForOrder, resetDb } from "../src/db.js";
import {
  charge,
  resetProviderState,
  setProviderRng,
  type ProviderConfig,
} from "../src/fakePaymentProvider.js";
import type { Order } from "../src/types.js";

const TEST_DB = path.join(process.cwd(), "data", "test-checkout.db");

const NO_NOISE_CONFIG: ProviderConfig = {
  declineRate: 0,
  lateAckRate: 0,
  latencyMs: 0,
};

function deterministicSequence(values: number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i] ?? values[values.length - 1] ?? 0;
    i += 1;
    return value;
  };
}

function createPendingOrder(id: string): void {
  const order: Order = {
    id,
    userId: "u_test",
    userName: "Test User",
    amount: 50,
    currency: "USD",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  createOrder(order);
}

beforeEach(() => {
  resetDb();
  getDb(TEST_DB);
  clearAll();
  resetProviderState();
});

afterEach(() => {
  resetDb();
});

describe("checkout", () => {
  it("completes a normal successful checkout", async () => {
    createPendingOrder("ord_ok");
    setProviderRng(deterministicSequence([0.9]));

    const result = await checkoutOrder("ord_ok", NO_NOISE_CONFIG);

    expect(result.status).toBe("paid");
    expect(result.successfulCharges).toBe(1);

    const txns = listTransactionsForOrder("ord_ok");
    expect(txns).toHaveLength(1);
    expect(txns[0].status).toBe("success");
  });

  it("can recover when the provider declines before charging", async () => {
    createPendingOrder("ord_retry");
    setProviderRng(deterministicSequence([0.01, 0.9]));

    const declineThenOk: ProviderConfig = {
      declineRate: 0.5,
      lateAckRate: 0,
      latencyMs: 0,
    };

    const result = await runCheckoutWithRetries("ord_retry", declineThenOk);

    expect(result.status).toBe("paid");

    const txns = listTransactionsForOrder("ord_retry");
    expect(txns.some((t) => t.status === "failed")).toBe(true);
    expect(txns.filter((t) => t.status === "success")).toHaveLength(1);
  });

  it("records provider charge attempts", async () => {
    const request = {
      orderId: "ord_log",
      userId: "u_log",
      userName: "Log User",
      amount: 10,
      currency: "USD",
    };

    setProviderRng(deterministicSequence([0.2]));
    await expect(
      charge(request, { declineRate: 0.1, lateAckRate: 0.2, latencyMs: 0 })
    ).rejects.toThrow();

    setProviderRng(deterministicSequence([0.9]));
    const ok = await charge(request, NO_NOISE_CONFIG);
    expect(ok.chargeId).toMatch(/^ch_/);
  });
});
