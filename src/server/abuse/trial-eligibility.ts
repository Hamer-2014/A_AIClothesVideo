import type { JsonValue } from "@/lib/db/schema/common";

import { hashAbuseSignal } from "./hash";

export type TrialDecision = "allow" | "deny" | "review";

export interface TrialEligibilityInput {
  userId: string;
  email?: string | null;
  emailVerified?: boolean | null;
  oauthAccounts?: Array<{
    provider: string;
    providerAccountId: string;
  }>;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  now?: Date;
}

export interface TrialAbuseSignalInput {
  userId: string;
  videoJobId?: string | null;
  emailHash?: string | null;
  oauthProvider?: string | null;
  oauthAccountIdHash?: string | null;
  ipHash?: string | null;
  deviceFingerprintHash?: string | null;
  userAgentHash?: string | null;
  eventType: "trial_check" | "trial_granted" | "trial_denied";
  decision: TrialDecision;
  riskScore: number;
  reasonCodes: string[];
  metadata?: JsonValue | null;
  createdAt: Date;
}

export interface TrialEligibilityStore {
  countTrialUsagesByUserId(userId: string): Promise<number>;
  countTrialUsagesByEmailHash(emailHash: string): Promise<number>;
  countTrialUsagesByOauthAccount(
    provider: string,
    oauthAccountIdHash: string,
  ): Promise<number>;
  countRecentTrialSignalsByDevice(
    deviceFingerprintHash: string,
    since: Date,
  ): Promise<number>;
  countRecentTrialSignalsByIp(ipHash: string, since: Date): Promise<number>;
  countRecentTrialSignalsByIpAndUserAgent(
    ipHash: string,
    userAgentHash: string,
    since: Date,
  ): Promise<number>;
  createTrialAbuseSignal(input: TrialAbuseSignalInput): Promise<void>;
}

export interface TrialEligibilityResult {
  decision: TrialDecision;
  riskScore: number;
  reasonCodes: string[];
  signalSnapshot: JsonValue;
}

const disposableEmailDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "yopmail.com",
]);

const hardDenyReasons = new Set([
  "user_trial_used",
  "email_trial_used",
  "oauth_trial_used",
  "device_trial_recent",
  "ip_trial_limit",
  "ip_ua_trial_limit",
  "disposable_email",
  "email_unverified",
  "missing_abuse_hash_secret",
]);

function normalizedEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function emailDomain(email: string | null | undefined) {
  const normalized = normalizedEmail(email);
  const atIndex = normalized?.lastIndexOf("@") ?? -1;
  return atIndex >= 0 ? normalized?.slice(atIndex + 1) ?? null : null;
}

function resolveHashSecret({
  hashSecret,
  environment,
}: {
  hashSecret?: string | null;
  environment: string;
}) {
  const explicitSecret = hashSecret?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  if (environment === "production") {
    return null;
  }

  return "dev-abuse-hash-secret-do-not-use-in-production";
}

function decide(riskScore: number, reasonCodes: string[]): TrialDecision {
  if (reasonCodes.some((reason) => hardDenyReasons.has(reason))) {
    return "deny";
  }
  if (riskScore >= 70) {
    return "deny";
  }
  if (riskScore >= 40) {
    return "review";
  }
  return "allow";
}

function buildSnapshot({
  emailHash,
  oauthSignals,
  ipHash,
  deviceFingerprintHash,
  userAgentHash,
  environment,
}: {
  emailHash: string | null;
  oauthSignals: Array<{ provider: string; accountHash: string }>;
  ipHash: string | null;
  deviceFingerprintHash: string | null;
  userAgentHash: string | null;
  environment: string;
}): JsonValue {
  return {
    source: "trial_abuse_signals",
    environment,
    emailHash,
    oauthAccounts: oauthSignals,
    ipHash,
    deviceFingerprintHash,
    userAgentHash,
  };
}

export async function evaluateTrialEligibility({
  store,
  input,
  hashSecret,
  environment = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
}: {
  store: TrialEligibilityStore;
  input: TrialEligibilityInput;
  hashSecret?: string | null;
  environment?: string;
}): Promise<TrialEligibilityResult> {
  const now = input.now ?? new Date();
  const reasonCodes: string[] = [];
  let riskScore = 0;
  const secret = resolveHashSecret({ hashSecret, environment });

  if (!secret) {
    reasonCodes.push("missing_abuse_hash_secret");
    return {
      decision: "deny",
      riskScore: 100,
      reasonCodes,
      signalSnapshot: {
        source: "trial_abuse_signals",
        environment,
        secretConfigured: false,
      },
    };
  }

  const email = normalizedEmail(input.email);
  const emailHash = hashAbuseSignal(email, secret);
  const ipHash = hashAbuseSignal(input.ipAddress, secret);
  const deviceFingerprintHash = hashAbuseSignal(input.deviceFingerprint, secret);
  const userAgentHash = hashAbuseSignal(input.userAgent, secret);
  const oauthSignals = (input.oauthAccounts ?? []).flatMap((account) => {
    const accountHash = hashAbuseSignal(account.providerAccountId, secret);
    if (!accountHash) {
      return [];
    }
    return [{ provider: account.provider, accountHash }];
  });

  if (input.emailVerified === false) {
    reasonCodes.push("email_unverified");
  }

  const domain = emailDomain(email);
  if (domain && disposableEmailDomains.has(domain)) {
    reasonCodes.push("disposable_email");
  }

  if (!deviceFingerprintHash) {
    riskScore += 20;
    reasonCodes.push("missing_device_fingerprint");
  }

  if (!userAgentHash) {
    riskScore += 15;
    reasonCodes.push("missing_user_agent");
  }

  if ((await store.countTrialUsagesByUserId(input.userId)) > 0) {
    reasonCodes.push("user_trial_used");
  }

  if (emailHash && (await store.countTrialUsagesByEmailHash(emailHash)) > 0) {
    reasonCodes.push("email_trial_used");
  }

  for (const oauthSignal of oauthSignals) {
    const count = await store.countTrialUsagesByOauthAccount(
      oauthSignal.provider,
      oauthSignal.accountHash,
    );
    if (count > 0) {
      reasonCodes.push("oauth_trial_used");
      break;
    }
  }

  const deviceSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (
    deviceFingerprintHash &&
    (await store.countRecentTrialSignalsByDevice(
      deviceFingerprintHash,
      deviceSince,
    )) > 0
  ) {
    reasonCodes.push("device_trial_recent");
  }

  const ipSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (ipHash && (await store.countRecentTrialSignalsByIp(ipHash, ipSince)) >= 3) {
    reasonCodes.push("ip_trial_limit");
  }

  if (
    ipHash &&
    userAgentHash &&
    (await store.countRecentTrialSignalsByIpAndUserAgent(
      ipHash,
      userAgentHash,
      ipSince,
    )) >= 2
  ) {
    reasonCodes.push("ip_ua_trial_limit");
  }

  const decision = decide(riskScore, reasonCodes);
  const signalSnapshot = buildSnapshot({
    emailHash,
    oauthSignals,
    ipHash,
    deviceFingerprintHash,
    userAgentHash,
    environment,
  });

  await store.createTrialAbuseSignal({
    userId: input.userId,
    emailHash,
    oauthProvider: oauthSignals[0]?.provider ?? null,
    oauthAccountIdHash: oauthSignals[0]?.accountHash ?? null,
    ipHash,
    deviceFingerprintHash,
    userAgentHash,
    eventType: decision === "allow" ? "trial_check" : "trial_denied",
    decision,
    riskScore,
    reasonCodes,
    metadata: signalSnapshot,
    createdAt: now,
  });

  return {
    decision,
    riskScore,
    reasonCodes,
    signalSnapshot,
  };
}

export function createInMemoryTrialEligibilityStore(
  options: {
    userTrialCount?: number;
    emailTrialCount?: number;
    oauthTrialCount?: number;
    deviceSignalCount?: number;
    ipSignalCount?: number;
    ipUserAgentSignalCount?: number;
  } = {},
): TrialEligibilityStore & {
  signals: TrialAbuseSignalInput[];
  lastDeviceSince: Date | null;
} {
  const store = {
    signals: [] as TrialAbuseSignalInput[],
    lastDeviceSince: null as Date | null,
    async countTrialUsagesByUserId() {
      return options.userTrialCount ?? 0;
    },
    async countTrialUsagesByEmailHash() {
      return options.emailTrialCount ?? 0;
    },
    async countTrialUsagesByOauthAccount() {
      return options.oauthTrialCount ?? 0;
    },
    async countRecentTrialSignalsByDevice(
      _deviceFingerprintHash: string,
      since: Date,
    ) {
      store.lastDeviceSince = since;
      return options.deviceSignalCount ?? 0;
    },
    async countRecentTrialSignalsByIp() {
      return options.ipSignalCount ?? 0;
    },
    async countRecentTrialSignalsByIpAndUserAgent() {
      return options.ipUserAgentSignalCount ?? 0;
    },
    async createTrialAbuseSignal(input: TrialAbuseSignalInput) {
      store.signals.push(input);
    },
  };

  return store;
}
