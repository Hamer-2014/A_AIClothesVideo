import { describe, expect, it } from "vitest";

import {
  createInMemoryTrialEligibilityStore,
  evaluateTrialEligibility,
} from "./trial-eligibility";

const baseInput = {
  userId: "user-1",
  email: "seller@example.com",
  emailVerified: true,
  oauthAccounts: [{ provider: "google", providerAccountId: "google-1" }],
  ipAddress: "203.0.113.10",
  userAgent: "Vitest Browser",
  deviceFingerprint: "device-1",
  now: new Date("2026-06-13T08:00:00.000Z"),
};

describe("evaluateTrialEligibility", () => {
  it("denies when user already used a trial", async () => {
    const store = createInMemoryTrialEligibilityStore({ userTrialCount: 1 });

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("user_trial_used");
  });

  it("denies when email hash already used a trial", async () => {
    const store = createInMemoryTrialEligibilityStore({ emailTrialCount: 1 });

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("email_trial_used");
  });

  it("denies when OAuth account already used a trial", async () => {
    const store = createInMemoryTrialEligibilityStore({ oauthTrialCount: 1 });

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("oauth_trial_used");
  });

  it("denies when device fingerprint was granted within 7 days", async () => {
    const store = createInMemoryTrialEligibilityStore({ deviceSignalCount: 1 });

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("device_trial_recent");
    expect(store.lastDeviceSince?.toISOString()).toBe("2026-06-06T08:00:00.000Z");
  });

  it("denies when IP exceeds 24 hour threshold", async () => {
    const store = createInMemoryTrialEligibilityStore({ ipSignalCount: 3 });

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("ip_trial_limit");
  });

  it("denies when IP plus user agent exceeds 24 hour threshold", async () => {
    const store = createInMemoryTrialEligibilityStore({ ipUserAgentSignalCount: 2 });

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("ip_ua_trial_limit");
  });

  it("adds risk for missing device fingerprint without directly denying", async () => {
    const store = createInMemoryTrialEligibilityStore();

    const result = await evaluateTrialEligibility({
      store,
      input: { ...baseInput, deviceFingerprint: null },
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("allow");
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain("missing_device_fingerprint");
  });

  it("denies disposable email domains", async () => {
    const store = createInMemoryTrialEligibilityStore();

    const result = await evaluateTrialEligibility({
      store,
      input: { ...baseInput, email: "seller@mailinator.com" },
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("disposable_email");
  });

  it("denies unverified email", async () => {
    const store = createInMemoryTrialEligibilityStore();

    const result = await evaluateTrialEligibility({
      store,
      input: { ...baseInput, emailVerified: false },
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("email_unverified");
  });

  it("fails closed in production when hash secret is missing", async () => {
    const store = createInMemoryTrialEligibilityStore();

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "",
      environment: "production",
    });

    expect(result.decision).toBe("deny");
    expect(result.reasonCodes).toContain("missing_abuse_hash_secret");
  });

  it("does not expose raw sensitive signals in snapshot", async () => {
    const store = createInMemoryTrialEligibilityStore();

    const result = await evaluateTrialEligibility({
      store,
      input: baseInput,
      hashSecret: "test-secret",
      environment: "production",
    });

    expect(JSON.stringify(result.signalSnapshot)).not.toContain("device-1");
    expect(JSON.stringify(result.signalSnapshot)).not.toContain("google-1");
    expect(JSON.stringify(result.signalSnapshot)).not.toContain("203.0.113.10");
  });
});
