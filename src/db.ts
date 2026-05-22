import Database from "better-sqlite3";
import path from "node:path";
import type { Order, OrderStatus, Transaction } from "./types.js";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "payments.db");

let db: Database.Database | null = null;

export function getDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

export function resetDb(dbPath?: string): void {
  if (db) {
    db.close();
    db = null;
  }
  if (dbPath !== undefined) {
    getDb(dbPath);
  }
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      order_id TEXT NOT NULL,
      charge_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);
}

export function createOrder(order: Order): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO orders (id, user_id, user_name, amount, currency, status, created_at)
       VALUES (@id, @userId, @userName, @amount, @currency, @status, @createdAt)`
    )
    .run({
      id: order.id,
      userId: order.userId,
      userName: order.userName,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      createdAt: order.createdAt,
    });
}

export function getOrder(orderId: string): Order | undefined {
  const row = getDb()
    .prepare(
      `SELECT id, user_id, user_name, amount, currency, status, created_at
       FROM orders WHERE id = ?`
    )
    .get(orderId) as
    | {
        id: string;
        user_id: string;
        user_name: string;
        amount: number;
        currency: string;
        status: OrderStatus;
        created_at: string;
      }
    | undefined;

  if (!row) return undefined;

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function updateOrderStatus(orderId: string, status: OrderStatus): void {
  getDb().prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, orderId);
}

export function insertTransaction(txn: Transaction): void {
  getDb()
    .prepare(
      `INSERT INTO transactions
       (timestamp, user_id, user_name, order_id, charge_id, amount, currency, status, error_code)
       VALUES (@timestamp, @userId, @userName, @orderId, @chargeId, @amount, @currency, @status, @errorCode)`
    )
    .run({
      timestamp: txn.timestamp,
      userId: txn.userId,
      userName: txn.userName,
      orderId: txn.orderId,
      chargeId: txn.chargeId,
      amount: txn.amount,
      currency: txn.currency,
      status: txn.status,
      errorCode: txn.errorCode,
    });
}

export function listTransactionsForOrder(orderId: string): Transaction[] {
  const rows = getDb()
    .prepare(
      `SELECT timestamp, user_id, user_name, order_id, charge_id, amount, currency, status, error_code
       FROM transactions WHERE order_id = ? ORDER BY timestamp ASC`
    )
    .all(orderId) as Array<{
      timestamp: string;
      user_id: string;
      user_name: string;
      order_id: string;
      charge_id: string;
      amount: number;
      currency: string;
      status: string;
      error_code: string;
    }>;

  return rows.map((row) => ({
    timestamp: row.timestamp,
    userId: row.user_id,
    userName: row.user_name,
    orderId: row.order_id,
    chargeId: row.charge_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status as Transaction["status"],
    errorCode: row.error_code,
  }));
}

export function listPendingOrders(): Order[] {
  const rows = getDb()
    .prepare(
      `SELECT id, user_id, user_name, amount, currency, status, created_at
       FROM orders WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`
    )
    .all() as Array<{
      id: string;
      user_id: string;
      user_name: string;
      amount: number;
      currency: string;
      status: OrderStatus;
      created_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function clearAll(): void {
  const database = getDb();
  database.exec(`DELETE FROM transactions; DELETE FROM orders;`);
}
