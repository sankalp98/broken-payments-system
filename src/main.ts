import { checkoutOrder } from "./checkout.js";
import { clearAll, createOrder, getDb } from "./db.js";
import type { Order } from "./types.js";

function seedDemoOrders(): void {
  clearAll();
  const orders: Order[] = [
    {
      id: "ord_demo_1",
      userId: "u_100",
      userName: "Alex Rivera",
      amount: 42.5,
      currency: "USD",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  ];

  for (const order of orders) {
    createOrder(order);
  }
}

async function main(): Promise<void> {
  getDb();
  seedDemoOrders();
  const result = await checkoutOrder("ord_demo_1");
  console.log("Checkout result:", result);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
