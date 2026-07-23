import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { getCreditPackage } from "@/lib/credits/packages";
import {
  createCreemCheckout,
  CreemUnavailableError,
} from "@/lib/providers/creem/client";
import {
  createRuntimeFunnelEventStore,
  recordFunnelEventSafely,
  type FunnelEventStore,
} from "@/server/analytics/funnel-events";
import { createCheckoutOrder, type OrderStore } from "@/server/billing/orders";
import { createDrizzleOrderStore } from "@/server/billing/drizzle-orders";

function snapshotProviderCheckout(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(snapshotProviderCheckout);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      /api[_-]?key|authorization|secret|token|password/i.test(key)
        ? []
        : [[key, snapshotProviderCheckout(entry)]],
    ),
  );
}

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
  funnelEventStore?: FunnelEventStore;
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
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    ("amountCents" in body || "credits" in body)
  ) {
    return NextResponse.json(
      { error: "client_price_fields_not_allowed" },
      { status: 400 },
    );
  }

  const packageCode =
    typeof body.packageCode === "string" ? body.packageCode : "";
  const selectedPackage = getCreditPackage(packageCode);

  if (!selectedPackage) {
    return NextResponse.json(
      { error: "unknown_credit_package" },
      { status: 400 },
    );
  }

  if (!selectedPackage.creemProductId) {
    return NextResponse.json(
      { error: "billing_not_configured" },
      { status: 503 },
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
  const orderStore = deps.orderStore ?? createDrizzleOrderStore();
  try {
    const checkout = await createCheckout({
      productId: selectedPackage.creemProductId,
      requestId,
      successUrl: `${getAppUrl()}/billing/success`,
      metadata: {
        userId,
        packageCode: selectedPackage.code,
      },
    });

    await createCheckoutOrder({
      store: orderStore,
      userId,
      packageCode: selectedPackage.code,
      externalOrderId: checkout.externalOrderId ?? requestId,
      checkoutSnapshot: {
        creemProductId: selectedPackage.creemProductId,
        provider: snapshotProviderCheckout(checkout.raw),
      } as never,
    });
    await recordFunnelEventSafely({
      store: deps.funnelEventStore ?? createRuntimeFunnelEventStore(),
      eventName: "checkout_started",
      source: "server",
      userId,
      path: new URL(request.url).pathname,
      metadata: {
        sourcePage: "billing",
        status: "created",
      },
    });

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (error) {
    if (error instanceof CreemUnavailableError) {
      return NextResponse.json(
        { error: "billing_provider_unavailable" },
        { status: 503 },
      );
    }

    throw error;
  }
}

export async function POST(request: Request) {
  return handleBillingCheckoutRequest(request);
}
