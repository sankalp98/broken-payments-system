import path from "node:path";
import { generateRefundReportFromFile } from "../src/refundReport.js";

const INPUT = path.join(process.cwd(), "data", "transactions_10_11.csv");
const OUTPUT = path.join(process.cwd(), "data", "refund_report.csv");

const refunds = generateRefundReportFromFile(INPUT, OUTPUT);

console.log(`Wrote refund report: ${OUTPUT}`);
console.log(`Refund lines: ${refunds.length}`);
for (const line of refunds) {
  console.log(
    `  ${line.userName} (${line.userId}): ${line.currency} ${line.refundAmount.toFixed(2)} across ${line.orderIds.length} order(s)`
  );
}
