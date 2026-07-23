import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { getCreditPackage } from "@/lib/credits/packages";
import {
  createCreemCheckout,
  CreemCheckoutError,
  CreemUnavailableError,
} from "@/lib/providers/creem/client";
import { isCreemPurchasesEnabled } from "@/lib/providers/creem/config";
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
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

async function readCheckoutBody(request: Request) {
  const value = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
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

  const body = await readCheckoutBody(request);
  if (!body) {
    return NextResponse.json(
      { error: "invalid_checkout_request" },
      { status: 400 },
    );
  }

  if (
    "amountCents" in body ||
    "credits" in body ||
    "productId" in body
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

  if (!isCreemPurchasesEnabled()) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
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
  await createCheckoutOrder({
    store: orderStore,
    userId,
    packageCode: selectedPackage.code,
    externalOrderId: requestId,
    checkoutSnapshot: {
      creemProductId: selectedPackage.creemProductId,
    },
  });

  try {
    const checkout = await createCheckout({
      productId: selectedPackage.creemProductId,
      requestId,
      successUrl: `${getAppUrl()}/billing/success?order=${encodeURIComponent(requestId)}`,
      metadata: {
        userId,
        packageCode: selectedPackage.code,
      },
    });

    await orderStore.updateCheckoutSnapshot(
      requestId,
      {
        creemProductId: selectedPackage.creemProductId,
        provider: snapshotProviderCheckout(checkout.raw),
      } as never,
    );
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
    await orderStore.markOrderStatus(requestId, "failed");

    if (error instanceof CreemUnavailableError) {
      return NextResponse.json(
        { error: "billing_provider_unavailable" },
        { status: 503 },
      );
    }

    if (error instanceof CreemCheckoutError) {
      return NextResponse.json(
        { error: "billing_provider_error" },
        { status: 502 },
      );
    }

    throw error;
  }
}

export async function POST(request: Request) {
  return handleBillingCheckoutRequest(request);
}
