import fs from "node:fs";
import path from "node:path";
import type { RefundLine, Transaction } from "./types.js";

export function parseTransactionsCsv(csv: string): Transaction[] {
  const lines = csv.trim().split("\n");
  const [header, ...rows] = lines;
  if (!header) return [];

  const columns = header.split(",").map((c) => c.trim());
  const index = (name: string) => columns.indexOf(name);

  return rows
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split(",");
      return {
        timestamp: parts[index("timestamp")] ?? "",
        userId: parts[index("user_id")] ?? "",
        userName: parts[index("user_name")] ?? "",
        orderId: parts[index("order_id")] ?? "",
        chargeId: parts[index("charge_id")] ?? "",
        amount: Number(parts[index("amount")]),
        currency: parts[index("currency")] ?? "",
        status: (parts[index("status")] ?? "failed") as Transaction["status"],
        errorCode: parts[index("error_code")] ?? "",
      };
    });
}

export function calculateRefunds(transactions: Transaction[]): RefundLine[] {
  const successful = transactions.filter((t) => t.status === "success");
  const byOrder = new Map<string, Transaction[]>();

  for (const txn of successful) {
    const list = byOrder.get(txn.orderId) ?? [];
    list.push(txn);
    byOrder.set(txn.orderId, list);
  }

  const refunds: RefundLine[] = [];
  const grouped = new Map<string, RefundLine>();

  for (const [, charges] of byOrder) {
    if (charges.length <= 1) continue;

    const sorted = [...charges].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const keep = sorted[0];
    const extras = sorted.slice(1);

    for (const extra of extras) {
      const key = `${extra.userId}|${extra.userName}|${extra.currency}`;
      const existing = grouped.get(key) ?? {
        userId: extra.userId,
        userName: extra.userName,
        currency: extra.currency,
        refundAmount: 0,
        orderIds: [],
        chargeIds: [],
      };

      existing.refundAmount += extra.amount;
      if (!existing.orderIds.includes(extra.orderId)) {
        existing.orderIds.push(extra.orderId);
      }
      existing.chargeIds.push(extra.chargeId);
      grouped.set(key, existing);
    }

    void keep;
  }

  return [...grouped.values()].sort((a, b) => a.userId.localeCompare(b.userId));
}

export function formatRefundReportCsv(lines: RefundLine[]): string {
  const header =
    "user_id,user_name,currency,refund_amount,order_ids,charge_ids";
  const rows = lines.map((line) => {
    const orderIds = line.orderIds.join(";");
    const chargeIds = line.chargeIds.join(";");
    return `${line.userId},${line.userName},${line.currency},${line.refundAmount.toFixed(2)},${orderIds},${chargeIds}`;
  });
  return [header, ...rows].join("\n") + (rows.length > 0 ? "\n" : "");
}

export function generateRefundReportFromFile(
  inputPath: string,
  outputPath: string
): RefundLine[] {
  const csv = fs.readFileSync(inputPath, "utf8");
  const transactions = parseTransactionsCsv(csv);
  const refunds = calculateRefunds(transactions);
  const output = formatRefundReportCsv(refunds);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, "utf8");
  return refunds;
}
