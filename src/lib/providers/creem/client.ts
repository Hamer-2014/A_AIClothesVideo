import type { JsonValue } from "@/lib/db/schema/common";

import {
  CREEM_PRODUCTION_BASE_URL,
  isCreemLiveApiKey,
  isCreemProductionEnvironment,
} from "./config";

export class CreemUnavailableError extends Error {
  constructor(message = "Creem API key is not configured.") {
    super(message);
    this.name = "CreemUnavailableError";
  }
}

export interface CreemConfig {
  apiKey: string;
  baseUrl: string;
}

export interface CreateCreemCheckoutInput {
  productId: string;
  requestId: string;
  successUrl: string;
  metadata: Record<string, JsonValue>;
}

export interface CreemCheckoutResult {
  id: string;
  checkoutUrl: string;
  raw: JsonValue;
}

interface CreemClientDeps {
  fetch?: typeof fetch;
}

export function getCreemConfig(): CreemConfig {
  const apiKey = process.env.CREEM_API_KEY?.trim();

  if (!apiKey) {
    throw new CreemUnavailableError();
  }

  const baseUrl =
    process.env.CREEM_BASE_URL?.trim() || CREEM_PRODUCTION_BASE_URL;

  if (
    isCreemProductionEnvironment() &&
    (baseUrl !== CREEM_PRODUCTION_BASE_URL || !isCreemLiveApiKey(apiKey))
  ) {
    throw new CreemUnavailableError(
      "Creem production checkout credentials are not configured.",
    );
  }

  return { apiKey, baseUrl };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function createCreemCheckout(
  input: CreateCreemCheckoutInput,
  deps: CreemClientDeps = {},
): Promise<CreemCheckoutResult> {
  const config = getCreemConfig();
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/v1/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: input.productId,
      request_id: input.requestId,
      success_url: input.successUrl,
      metadata: input.metadata,
    }),
  });

  const raw = asRecord(await response.json());

  if (!response.ok) {
    throw new Error(`Creem checkout failed with status ${response.status}.`);
  }

  const id = raw.id;
  const checkoutUrl = raw.checkout_url ?? raw.checkoutUrl;

  if (typeof id !== "string" || typeof checkoutUrl !== "string") {
    throw new Error("Creem checkout response is missing id or checkout URL.");
  }

  return {
    id,
    checkoutUrl,
    raw: raw as JsonValue,
  };
}
