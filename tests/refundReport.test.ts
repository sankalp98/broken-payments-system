import { describe, expect, it } from "vitest";
import {
  calculateRefunds,
  formatRefundReportCsv,
  parseTransactionsCsv,
} from "../src/refundReport.js";

describe("refund report", () => {
  it("refunds duplicate successful charges for the same order", () => {
    const csv = `timestamp,user_id,user_name,order_id,charge_id,amount,currency,status,error_code
2025-10-11T10:00:00Z,u_1,User One,ord_dup,ch_a,10.00,USD,success,
2025-10-11T10:00:05Z,u_1,User One,ord_dup,ch_b,10.00,USD,success,`;

    const refunds = calculateRefunds(parseTransactionsCsv(csv));

    expect(refunds).toHaveLength(1);
    expect(refunds[0].userId).toBe("u_1");
    expect(refunds[0].refundAmount).toBe(10);
    expect(refunds[0].chargeIds).toEqual(["ch_b"]);
  });

  it("ignores failed charges when calculating refunds", () => {
    const csv = `timestamp,user_id,user_name,order_id,charge_id,amount,currency,status,error_code
2025-10-11T10:00:00Z,u_2,User Two,ord_x,ch_fail,25.00,USD,failed,CARD_DECLINED
2025-10-11T10:00:10Z,u_2,User Two,ord_x,ch_ok,25.00,USD,success,`;

    const refunds = calculateRefunds(parseTransactionsCsv(csv));
    expect(refunds).toHaveLength(0);
  });

  it("formats refund report CSV", () => {
    const csv = formatRefundReportCsv([
      {
        userId: "u_9",
        userName: "Nine",
        currency: "USD",
        refundAmount: 5.5,
        orderIds: ["ord_9"],
        chargeIds: ["ch_9"],
      },
    ]);

    expect(csv).toContain("user_id,user_name,currency,refund_amount");
    expect(csv).toContain("u_9,Nine,USD,5.50,ord_9,ch_9");
  });
});
