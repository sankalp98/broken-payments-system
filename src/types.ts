export type OrderStatus = "pending" | "paid" | "failed";

export type TransactionStatus = "success" | "failed";

export interface Order {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
}

export interface Transaction {
  timestamp: string;
  userId: string;
  userName: string;
  orderId: string;
  chargeId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  errorCode: string;
}

export interface ChargeRequest {
  orderId: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
}

export interface RefundLine {
  userId: string;
  userName: string;
  currency: string;
  refundAmount: number;
  orderIds: string[];
  chargeIds: string[];
}
