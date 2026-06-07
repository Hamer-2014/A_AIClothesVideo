import { NextResponse } from "next/server";

import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import type { CreditLedgerStore } from "@/lib/credits/types";
import {
  parseCreemWebhookEvent,
  verifyCreemWebhookSignature,
  WebhookSignatureError,
} from "@/lib/providers/creem/webhook";
import { createDrizzleOrderStore } from "@/server/billing/drizzle-orders";
import {
  handleCreemCheckoutCompleted,
  type OrderStore,
} from "@/server/billing/orders";

interface CreemWebhookDeps {
  orderStore?: OrderStore;
  ledgerStore?: CreditLedgerStore;
}

export async function handleCreemWebhookRequest(
  request: Request,
  deps: CreemWebhookDeps = {},
) {
  const rawBody = await request.text();
  const signature = request.headers.get("creem-signature");

  try {
    verifyCreemWebhookSignature(rawBody, signature);
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    throw error;
  }

  const event = parseCreemWebhookEvent(rawBody);

  if ("ignored" in event) {
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    await handleCreemCheckoutCompleted({
      orderStore: deps.orderStore ?? createDrizzleOrderStore(),
      ledgerStore: deps.ledgerStore ?? createDrizzleCreditLedgerStore(),
      event,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}

export async function POST(request: Request) {
  return handleCreemWebhookRequest(request);
}
