import type { ChargeRequest } from "./types.js";

export type ProviderOutcome = "success" | "declined" | "late_ack";

export interface ProviderConfig {
  declineRate: number;
  lateAckRate: number;
  latencyMs: number;
}

export class ProviderResponseError extends Error {
  readonly code: string;
  readonly chargeId?: string;

  constructor(code: string, chargeId?: string) {
    super(`Provider returned ${code}`);
    this.name = "ProviderResponseError";
    this.code = code;
    this.chargeId = chargeId;
  }
}

/** @deprecated use ProviderResponseError */
export class ProviderDeclinedError extends ProviderResponseError {
  constructor(code: string) {
    super(code);
    this.name = "ProviderDeclinedError";
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
  if (roll < config.declineRate + config.lateAckRate) {
    return "late_ack";
  }
  return "success";
}

export async function charge(
  _request: ChargeRequest,
  config: ProviderConfig
): Promise<{ chargeId: string }> {
  if (config.latencyMs > 0) {
    await sleep(config.latencyMs);
  }

  const outcome = pickOutcome(config);
  const chargeId = nextChargeId();

  if (outcome === "declined") {
    throw new ProviderResponseError("CARD_DECLINED");
  }

  if (outcome === "late_ack") {
    throw new ProviderResponseError("GATEWAY_TIMEOUT", chargeId);
  }

  return { chargeId };
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  declineRate: 0.05,
  lateAckRate: 0.08,
  latencyMs: 25,
};

export const SPIKE_PROVIDER_CONFIG: ProviderConfig = {
  declineRate: 0.02,
  lateAckRate: 0.35,
  latencyMs: 80,
};
