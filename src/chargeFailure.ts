import { ProviderResponseError } from "./fakePaymentProvider.js";

export type FailureDisposition = "retry" | "settled";

export interface ClassifiedFailure {
  disposition: FailureDisposition;
  recordStatus: "success" | "failed";
  chargeId: string;
  errorCode: string;
}

export function classifyProviderFailure(
  error: unknown,
  attempt: number
): ClassifiedFailure {
  if (error instanceof ProviderResponseError) {
    if (error.code === "CARD_DECLINED") {
      return {
        disposition: "retry",
        recordStatus: "failed",
        chargeId: `declined_${attempt}`,
        errorCode: error.code,
      };
    }

    if (error.code === "GATEWAY_TIMEOUT" && error.chargeId) {
      return {
        disposition: "retry",
        recordStatus: "success",
        chargeId: error.chargeId,
        errorCode: error.code,
      };
    }

    return {
      disposition: "retry",
      recordStatus: "failed",
      chargeId: `provider_${attempt}`,
      errorCode: error.code,
    };
  }

  return {
    disposition: "retry",
    recordStatus: "failed",
    chargeId: `error_${attempt}`,
    errorCode: "UNKNOWN",
  };
}
