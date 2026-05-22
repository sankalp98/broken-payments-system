import {
  charge,
  type ProviderConfig,
} from "./fakePaymentProvider.js";
import type { ChargeRequest } from "./types.js";

export async function submitCharge(
  request: ChargeRequest,
  config: ProviderConfig
): Promise<{ chargeId: string }> {
  return charge(request, config);
}
