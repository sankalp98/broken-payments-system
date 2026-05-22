import fs from "node:fs";
import path from "node:path";

type Row = {
  timestamp: string;
  userId: string;
  userName: string;
  orderId: string;
  chargeId: string;
  amount: number;
  currency: string;
  status: "success" | "failed";
  errorCode: string;
};

const OUTPUT = path.join(process.cwd(), "data", "transactions_10_11.csv");

let chargeSeq = 100;
let tick = 2 * 60 + 14;

function nextChargeId(): string {
  chargeSeq += 1;
  return `ch_${String(chargeSeq).padStart(6, "0")}`;
}

function nextTimestamp(): string {
  tick += 23;
  if (tick > 59 * 60 + 50) tick = 59 * 60 + 50;
  const minutes = Math.floor(tick / 60);
  const seconds = tick % 60;
  return `2025-10-11T10:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}Z`;
}

function row(
  userId: string,
  userName: string,
  orderId: string,
  amount: number,
  currency: string,
  status: Row["status"],
  errorCode: string,
  timestamp?: string
): Row {
  return {
    timestamp: timestamp ?? nextTimestamp(),
    userId,
    userName,
    orderId,
    chargeId: nextChargeId(),
    amount,
    currency,
    status,
    errorCode,
  };
}

function duplicateOrder(
  userId: string,
  userName: string,
  orderId: string,
  amount: number,
  currency: string,
  count: 2 | 3
): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i += 1) {
    const isTimeout = i < count - 1;
    rows.push(
      row(
        userId,
        userName,
        orderId,
        amount,
        currency,
        "success",
        isTimeout ? (orderId.endsWith("1") ? "PROVIDER_TIMEOUT" : "GATEWAY_TIMEOUT") : ""
      )
    );
  }
  return rows;
}

function formatCsv(rows: Row[]): string {
  const header =
    "timestamp,user_id,user_name,order_id,charge_id,amount,currency,status,error_code";
  const lines = rows.map((r) => {
    const amount = r.amount.toFixed(2);
    return `${r.timestamp},${r.userId},${r.userName},${r.orderId},${r.chargeId},${amount},${r.currency},${r.status},${r.errorCode}`;
  });
  return `${header}\n${lines.join("\n")}\n`;
}

function buildDataset(): Row[] {
  const rows: Row[] = [];

  const anchors: Array<[string, string, string, number, string, Row["status"], string, string]> = [
    ["2025-10-11T10:02:14Z", "u_101", "Morgan Lee", "ord_1001", 24.99, "USD", "success", ""],
    ["2025-10-11T10:03:41Z", "u_102", "Jordan Kim", "ord_1002", 59.0, "USD", "success", ""],
    ["2025-10-11T10:05:08Z", "u_103", "Sam Patel", "ord_1003", 18.5, "USD", "success", ""],
    ["2025-10-11T10:06:22Z", "u_104", "Casey Nguyen", "ord_1004", 42.0, "USD", "success", ""],
    ["2025-10-11T10:07:55Z", "u_105", "Riley Brooks", "ord_1005", 75.25, "USD", "success", ""],
    ["2025-10-11T10:09:18Z", "u_201", "Avery Chen", "ord_2001", 49.99, "USD", "success", ""],
    ["2025-10-11T10:10:02Z", "u_201", "Avery Chen", "ord_2002", 49.99, "USD", "success", ""],
    ["2025-10-11T10:11:37Z", "u_202", "Blake Ortiz", "ord_2003", 49.99, "USD", "success", ""],
    ["2025-10-11T10:12:49Z", "u_203", "Charlie Wu", "ord_2004", 49.99, "USD", "success", ""],
    ["2025-10-11T10:14:03Z", "u_301", "Taylor Reed", "ord_3001", 35.0, "USD", "failed", "CARD_DECLINED"],
    ["2025-10-11T10:14:45Z", "u_301", "Taylor Reed", "ord_3001", 35.0, "USD", "success", ""],
    ["2025-10-11T10:16:20Z", "u_302", "Jamie Fox", "ord_3002", 120.0, "USD", "failed", "INSUFFICIENT_FUNDS"],
    ["2025-10-11T10:18:11Z", "u_401", "Robin Shaw", "ord_4001", 89.0, "USD", "success", "PROVIDER_TIMEOUT"],
    ["2025-10-11T10:18:47Z", "u_401", "Robin Shaw", "ord_4001", 89.0, "USD", "success", ""],
    ["2025-10-11T10:21:05Z", "u_501", "Drew Ellis", "ord_5001", 64.5, "USD", "success", "PROVIDER_TIMEOUT"],
    ["2025-10-11T10:21:41Z", "u_501", "Drew Ellis", "ord_5001", 64.5, "USD", "success", "PROVIDER_TIMEOUT"],
    ["2025-10-11T10:22:16Z", "u_501", "Drew Ellis", "ord_5001", 64.5, "USD", "success", ""],
  ];

  for (const [ts, userId, userName, orderId, amount, currency, status, errorCode] of anchors) {
    rows.push({
      timestamp: ts,
      userId,
      userName,
      orderId,
      chargeId: nextChargeId(),
      amount,
      currency,
      status,
      errorCode,
    });
  }

  tick = 24 * 60 + 33;

  const singles = [
    ["u_106", "Quinn Adams", 31.75],
    ["u_107", "Parker Bell", 15.0],
    ["u_108", "Sage Cole", 99.99],
    ["u_109", "Reese Dunn", 22.4],
    ["u_110", "Finley Gray", 55.0],
    ["u_111", "Jules Owen", 38.9],
    ["u_112", "Kai Price", 12.99],
    ["u_113", "Lane Quinn", 67.25],
    ["u_114", "Marlow Reed", 8.5],
    ["u_115", "Noel Shaw", 143.0],
    ["u_116", "Ocean Tate", 26.0],
    ["u_117", "Peyton Vale", 54.75],
    ["u_118", "Rory West", 19.99],
    ["u_119", "Skyler Yen", 72.1],
    ["u_120", "Tatum Zee", 33.33],
    ["u_121", "Uma Agarwal", 41.0],
    ["u_122", "Vale Becker", 96.5],
    ["u_123", "Wren Costa", 14.25],
    ["u_124", "Xen Diaz", 58.8],
    ["u_125", "Yael Evans", 27.6],
    ["u_126", "Zion Ford", 61.0],
    ["u_127", "Ada Grant", 47.15],
    ["u_128", "Bea Hale", 5.99],
    ["u_129", "Cade Irwin", 88.0],
    ["u_130", "Demi Jones", 36.4],
    ["u_204", "Harper Lane", 49.99],
    ["u_205", "Indigo Moss", 49.99],
    ["u_206", "Jules Moss", 49.99],
    ["u_207", "Kiran Moss", 49.99],
    ["u_208", "Lena Moss", 49.99],
    ["u_209", "Milo Moss", 49.99],
    ["u_210", "Nico Moss", 49.99],
    ["u_211", "Oona Moss", 49.99],
    ["u_212", "Pia Moss", 49.99],
    ["u_213", "Quin Moss", 49.99],
    ["u_214", "Rae Moss", 49.99],
    ["u_131", "Sage North", 11.5],
    ["u_132", "Tia Ortiz", 77.77],
    ["u_133", "Uri Patel", 29.0],
    ["u_134", "Vic Quinn", 63.2],
    ["u_135", "Wes Reed", 44.44],
    ["u_136", "Xia Shaw", 91.0],
    ["u_137", "Yuri Tate", 16.75],
    ["u_138", "Zara Upton", 52.0],
    ["u_139", "Ari Vale", 37.9],
    ["u_140", "Bo West", 68.68],
  ] as const;

  let orderNum = 1006;
  for (const [userId, userName, amount] of singles) {
    rows.push(row(userId, userName, `ord_${orderNum}`, amount, "USD", "success", ""));
    orderNum += 1;
  }

  const legitSameAmount: Array<[string, string, number, string]> = [
    ["u_601", "Cameron Bell", 39.99, "ord_601a"],
    ["u_601", "Cameron Bell", 39.99, "ord_601b"],
    ["u_602", "Dakota Bell", 29.99, "ord_602a"],
    ["u_602", "Dakota Bell", 29.99, "ord_602b"],
    ["u_602", "Dakota Bell", 29.99, "ord_602c"],
    ["u_603", "Emery Bell", 19.5, "ord_603a"],
    ["u_603", "Emery Bell", 19.5, "ord_603b"],
    ["u_604", "Frankie Bell", 74.0, "ord_604a"],
    ["u_604", "Frankie Bell", 74.0, "ord_604b"],
    ["u_605", "Gray Bell", 49.99, "ord_605a"],
    ["u_605", "Gray Bell", 49.99, "ord_605b"],
    ["u_606", "Hayden Bell", 49.99, "ord_606a"],
    ["u_606", "Hayden Bell", 49.99, "ord_606b"],
  ];

  for (const [userId, userName, amount, orderId] of legitSameAmount) {
    rows.push(row(userId, userName, orderId, amount, "USD", "success", ""));
  }

  const duplicates2: Array<[string, string, string, number, string]> = [
    ["u_701", "Iris Cole", "ord_701", 52.25, "USD"],
    ["u_702", "Jade Cole", "ord_702", 18.0, "USD"],
    ["u_703", "Koa Cole", "ord_703", 95.5, "USD"],
    ["u_704", "Liv Cole", "ord_704", 41.2, "USD"],
    ["u_705", "Max Cole", "ord_705", 33.0, "USD"],
    ["u_706", "Nia Cole", "ord_706", 76.0, "USD"],
    ["u_707", "Omar Cole", "ord_707", 12.5, "USD"],
    ["u_708", "Paz Cole", "ord_708", 108.75, "USD"],
    ["u_709", "Rio Cole", "ord_709", 57.99, "USD"],
    ["u_710", "Sol Cole", "ord_710", 24.0, "USD"],
    ["u_711", "Tia Cole", "ord_711", 61.4, "EUR"],
    ["u_712", "Ugo Cole", "ord_712", 61.4, "EUR"],
  ];

  for (const [userId, userName, orderId, amount, currency] of duplicates2) {
    rows.push(...duplicateOrder(userId, userName, orderId, amount, currency, 2));
  }

  const duplicates3: Array<[string, string, string, number, string]> = [
    ["u_801", "Vera Dunn", "ord_801", 44.0, "USD"],
    ["u_802", "Wynn Dunn", "ord_802", 71.25, "USD"],
    ["u_803", "Xia Dunn", "ord_803", 19.95, "USD"],
    ["u_804", "York Dunn", "ord_804", 128.0, "USD"],
    ["u_805", "Zoe Dunn", "ord_805", 55.55, "EUR"],
  ];

  for (const [userId, userName, orderId, amount, currency] of duplicates3) {
    rows.push(...duplicateOrder(userId, userName, orderId, amount, currency, 3));
  }

  const multiDupSameUser: Array<[string, string, number, string]> = [
    ["u_901", "Alex Kim", 40.0, "ord_901"],
    ["u_901", "Alex Kim", 40.0, "ord_902"],
    ["u_902", "Bailey Kim", 22.0, "ord_903"],
    ["u_902", "Bailey Kim", 22.0, "ord_904"],
  ];

  for (const [userId, userName, amount, orderId] of multiDupSameUser) {
    rows.push(...duplicateOrder(userId, userName, orderId, amount, "USD", 2));
  }

  const failedOnly: Array<[string, string, string, number, string]> = [
    ["u_302", "Jamie Fox", "ord_3003", 45.0, "CARD_DECLINED"],
    ["u_402", "Kit Nash", "ord_4002", 27.5, "CARD_DECLINED"],
    ["u_951", "Cora Nash", "ord_951", 90.0, "CARD_DECLINED"],
    ["u_952", "Dana Nash", "ord_952", 13.0, "INSUFFICIENT_FUNDS"],
    ["u_953", "Eli Nash", "ord_953", 200.0, "INSUFFICIENT_FUNDS"],
    ["u_954", "Fay Nash", "ord_954", 6.75, "CARD_DECLINED"],
    ["u_955", "Gia Nash", "ord_955", 48.0, "PROCESSOR_ERROR"],
    ["u_956", "Hal Nash", "ord_956", 31.0, "CARD_DECLINED"],
    ["u_957", "Ivy Nash", "ord_957", 77.25, "INSUFFICIENT_FUNDS"],
    ["u_958", "Jay Nash", "ord_958", 15.5, "CARD_DECLINED"],
    ["u_959", "Kim Nash", "ord_959", 102.0, "CARD_DECLINED"],
    ["u_960", "Leo Nash", "ord_960", 59.99, "INSUFFICIENT_FUNDS"],
  ];

  for (const [userId, userName, orderId, amount, errorCode] of failedOnly) {
    rows.push(row(userId, userName, orderId, amount, "USD", "failed", errorCode));
  }

  const recoverAfterFail: Array<[string, string, string, number, string]> = [
    ["u_971", "Mae Ortiz", "ord_971", 28.0, "CARD_DECLINED"],
    ["u_972", "Noa Ortiz", "ord_972", 64.0, "INSUFFICIENT_FUNDS"],
    ["u_973", "Ora Ortiz", "ord_973", 39.0, "CARD_DECLINED"],
    ["u_974", "Pia Ortiz", "ord_974", 51.5, "CARD_DECLINED"],
    ["u_975", "Quin Ortiz", "ord_975", 17.25, "INSUFFICIENT_FUNDS"],
    ["u_976", "Rae Ortiz", "ord_976", 83.0, "CARD_DECLINED"],
    ["u_977", "Sam Ortiz", "ord_977", 46.6, "CARD_DECLINED"],
    ["u_978", "Tia Ortiz", "ord_978", 72.75, "INSUFFICIENT_FUNDS"],
  ];

  for (const [userId, userName, orderId, amount, errorCode] of recoverAfterFail) {
    rows.push(row(userId, userName, orderId, amount, "USD", "failed", errorCode));
    rows.push(row(userId, userName, orderId, amount, "USD", "success", ""));
  }

  rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return rows;
}

const dataset = buildDataset();
fs.writeFileSync(OUTPUT, formatCsv(dataset), "utf8");
console.log(`Wrote ${dataset.length} transaction rows to ${OUTPUT}`);
