import type { Order } from "./types.js";

export const RETRY_ENABLED = true;

export function shouldRetryOrder(order: Order): boolean {
  if (!RETRY_ENABLED) {
    return false;
  }
  return order.status === "pending" || order.status === "failed";
}

export function maxInProcessAttempts(): number {
  return 3;
}
