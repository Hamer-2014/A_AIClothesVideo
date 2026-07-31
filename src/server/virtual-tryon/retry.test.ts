import { describe, expect, it } from "vitest";
import { retryDecision } from "./retry";

describe("virtual try-on retries", () => {
  it("retries only the first failed submit", () => {
    expect(retryDecision({ status: 429, attemptCount: 0, now: new Date(0) })).toMatchObject({ retry: true, nextRetryAt: new Date(30_000) });
    expect(retryDecision({ status: 429, attemptCount: 1, now: new Date(0) })).toEqual({ retry: false, errorCode: "http_429" });
    expect(retryDecision({ status: 400, attemptCount: 1, now: new Date(0) })).toEqual({ retry: false, errorCode: "http_400" });
  });

  it("recognizes APIMart HTTP error codes without requiring a separate status field", () => {
    expect(retryDecision({ code: "http_429", attemptCount: 0, now: new Date(0) })).toMatchObject({ retry: true, nextRetryAt: new Date(30_000) });
    expect(retryDecision({ code: "http_500", attemptCount: 0, now: new Date(0) })).toMatchObject({ retry: true, nextRetryAt: new Date(30_000) });
    expect(retryDecision({ code: "http_400", attemptCount: 0, now: new Date(0) })).toEqual({ retry: false, errorCode: "http_400" });
  });
});
