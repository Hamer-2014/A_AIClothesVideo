import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCreemCheckout,
  CreemCheckoutError,
  CreemUnavailableError,
  getCreemConfig,
} from "./client";

describe("Creem client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses test API base URL when explicitly configured", () => {
    vi.stubEnv("CREEM_API_KEY", "creem_test_key");
    vi.stubEnv("CREEM_BASE_URL", "https://test-api.creem.io");

    expect(getCreemConfig()).toEqual({
      apiKey: "creem_test_key",
      baseUrl: "https://test-api.creem.io",
    });
  });

  it("throws when the API key is missing", () => {
    vi.stubEnv("CREEM_API_KEY", "");

    expect(() => getCreemConfig()).toThrow(CreemUnavailableError);
  });

  it("rejects sandbox checkout credentials in production", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("CREEM_API_KEY", "creem_test_key");
    vi.stubEnv("CREEM_BASE_URL", "https://test-api.creem.io");

    expect(() => getCreemConfig()).toThrow(CreemUnavailableError);
  });

  it("accepts live checkout credentials in production", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("CREEM_API_KEY", "creem_live_api_key");
    vi.stubEnv("CREEM_BASE_URL", "https://api.creem.io");

    expect(getCreemConfig()).toEqual({
      apiKey: "creem_live_api_key",
      baseUrl: "https://api.creem.io",
    });
  });

  it("creates a checkout through the Creem API", async () => {
    vi.stubEnv("CREEM_API_KEY", "creem_test_key");
    vi.stubEnv("CREEM_BASE_URL", "https://test-api.creem.io");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return (
      Response.json({
        id: "ch_123",
        checkout_url: "https://checkout.creem.io/ch_123",
      })
      );
    };

    const result = await createCreemCheckout(
      {
        productId: "creator",
        requestId: "order-1",
        successUrl: "https://app.example/billing/success",
        metadata: {
          userId: "user-1",
          packageCode: "creator",
        },
      },
      { fetch: fetchMock },
    );

    expect(calls[0]).toEqual([
      "https://test-api.creem.io/v1/checkouts",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-api-key": "creem_test_key",
          "Content-Type": "application/json",
        },
      }),
    ]);
    const requestInit = calls[0]?.[1];
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      product_id: "creator",
      request_id: "order-1",
      success_url: "https://app.example/billing/success",
      metadata: {
        userId: "user-1",
        packageCode: "creator",
      },
    });
    expect(result).toEqual({
      id: "ch_123",
      checkoutUrl: "https://checkout.creem.io/ch_123",
      raw: {
        id: "ch_123",
        checkout_url: "https://checkout.creem.io/ch_123",
      },
    });
  });

  it("does not fabricate checkout success when Creem returns an error", async () => {
    vi.stubEnv("CREEM_API_KEY", "creem_test_key");
    const fetchMock: typeof fetch = async () =>
      Response.json({ error: "invalid_product" }, { status: 400 });

    const promise =
      createCreemCheckout(
        {
          productId: "missing",
          requestId: "order-1",
          successUrl: "https://app.example/billing/success",
          metadata: { userId: "user-1" },
        },
        { fetch: fetchMock },
      );

    await expect(promise).rejects.toBeInstanceOf(CreemCheckoutError);
    await expect(promise).rejects.toMatchObject({ status: 400 });
  });
});
