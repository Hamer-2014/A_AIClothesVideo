import { describe, expect, it } from "vitest";
import { retryDecision } from "./retry";

describe("virtual try-on retries", () => {
  it("retries 429 and stops on provider failure", () => {
    expect(retryDecision({ status: 429, attemptCount: 1, now: new Date(0) })).toMatchObject({ retry: true, nextRetryAt: new Date(30_000) });
    expect(retryDecision({ status: 400, attemptCount: 1, now: new Date(0) })).toEqual({ retry: false, errorCode: "http_400" });
  });
});
