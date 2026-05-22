import type { ChargeRequest } from "./types.js";

export type ProviderOutcome = "success" | "declined" | "timeout_after_charge";

export interface ProviderConfig {
  declineRate: number;
  timeoutAfterChargeRate: number;
  latencyMs: number;
}

export class ProviderTimeoutError extends Error {
  readonly chargeId: string;

  constructor(chargeId: string) {
    super(`Payment provider request timed out (charge_id=${chargeId})`);
    this.name = "ProviderTimeoutError";
    this.chargeId = chargeId;
  }
}

export class ProviderDeclinedError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Payment declined: ${code}`);
    this.name = "ProviderDeclinedError";
    this.code = code;
  }
}

let chargeCounter = 0;
let rng = Math.random;

export function setProviderRng(random: () => number): void {
  rng = random;
}

export function resetProviderState(): void {
  chargeCounter = 0;
  rng = Math.random;
}

function nextChargeId(): string {
  chargeCounter += 1;
  return `ch_${String(chargeCounter).padStart(6, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickOutcome(config: ProviderConfig): ProviderOutcome {
  const roll = rng();
  if (roll < config.declineRate) {
    return "declined";
  }
  if (roll < config.declineRate + config.timeoutAfterChargeRate) {
    return "timeout_after_charge";
  }
  return "success";
}

export async function charge(
  request: ChargeRequest,
  config: ProviderConfig
): Promise<{ chargeId: string }> {
  if (config.latencyMs > 0) {
    await sleep(config.latencyMs);
  }

  const outcome = pickOutcome(config);
  const chargeId = nextChargeId();

  if (outcome === "declined") {
    throw new ProviderDeclinedError("CARD_DECLINED");
  }

  if (outcome === "timeout_after_charge") {
    throw new ProviderTimeoutError(chargeId);
  }

  return { chargeId };
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  declineRate: 0.05,
  timeoutAfterChargeRate: 0.08,
  latencyMs: 25,
};

export const SPIKE_PROVIDER_CONFIG: ProviderConfig = {
  declineRate: 0.02,
  timeoutAfterChargeRate: 0.35,
  latencyMs: 80,
};
