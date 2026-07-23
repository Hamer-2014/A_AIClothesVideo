import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { createDrizzleOrderStore } from "@/server/billing/drizzle-orders";
import type { OrderStore } from "@/server/billing/orders";

type BillingOrderSession = {
  user?: {
    id?: string;
  };
} | null;

interface GetBillingOrderDeps {
  getSession?: () => Promise<BillingOrderSession>;
  orderStore?: OrderStore;
}

export async function handleGetBillingOrderRequest(
  externalOrderId: string,
  deps: GetBillingOrderDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orderStore = deps.orderStore ?? createDrizzleOrderStore();
  const order = await orderStore.findOrderByExternalOrderId(externalOrderId);

  // Do not reveal whether an order belongs to another user.
  if (!order || order.userId !== userId) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    status: order.status,
    packageCode: order.productCode,
    creditsGranted: order.creditsGranted,
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ externalOrderId: string }> },
) {
  const { externalOrderId } = await context.params;
  return handleGetBillingOrderRequest(externalOrderId);
}
