import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { getCreditPackage } from "@/lib/credits/packages";
import { createCreemCheckout } from "@/lib/providers/creem/client";
import { createCheckoutOrder, type OrderStore } from "@/server/billing/orders";
import { createDrizzleOrderStore } from "@/server/billing/drizzle-orders";

type BillingSession = {
  user?: {
    id?: string;
  };
} | null;

interface CheckoutResult {
  id: string;
  externalOrderId?: string;
  checkoutUrl: string;
  raw: unknown;
}

interface BillingCheckoutDeps {
  getSession?: () => Promise<BillingSession>;
  orderStore?: OrderStore;
  createCheckout?: (input: {
    productId: string;
    requestId: string;
    successUrl: string;
    metadata: Record<string, string>;
  }) => Promise<CheckoutResult>;
}

function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function handleBillingCheckoutRequest(
  request: Request,
  deps: BillingCheckoutDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const packageCode =
    typeof body.packageCode === "string" ? body.packageCode : "";
  const selectedPackage = getCreditPackage(packageCode);

  if (!selectedPackage) {
    return NextResponse.json(
      { error: "unknown_credit_package" },
      { status: 400 },
    );
  }

  const requestId = randomUUID();
  const createCheckout =
    deps.createCheckout ??
    ((input) =>
      createCreemCheckout({
        productId: input.productId,
        requestId: input.requestId,
        successUrl: input.successUrl,
        metadata: input.metadata,
      }).then((result) => ({
        ...result,
        externalOrderId: input.requestId,
      })));
  const checkout = await createCheckout({
    productId: selectedPackage.creemProductId,
    requestId,
    successUrl: `${getAppUrl()}/billing/success`,
    metadata: {
      userId,
      packageCode: selectedPackage.code,
    },
  });
  const orderStore = deps.orderStore ?? createDrizzleOrderStore();

  await createCheckoutOrder({
    store: orderStore,
    userId,
    packageCode: selectedPackage.code,
    externalOrderId: checkout.externalOrderId ?? requestId,
    checkoutSnapshot: checkout.raw as never,
  });

  return NextResponse.json({
    checkoutUrl: checkout.checkoutUrl,
  });
}

export async function POST(request: Request) {
  return handleBillingCheckoutRequest(request);
}
