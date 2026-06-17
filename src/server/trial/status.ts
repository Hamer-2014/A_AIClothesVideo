import { and, eq, gte } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  freeTrialUsages,
  trialAbuseSignals,
} from "@/lib/db/schema";
import {
  evaluateTrialEligibility,
  type TrialAbuseSignalInput,
  type TrialEligibilityInput,
  type TrialEligibilityResult,
  type TrialEligibilityStore,
} from "@/server/abuse/trial-eligibility";

export type TrialStatus =
  | {
      state: "available";
      message: string;
      limits: {
        durationSeconds: 8;
        qualityLabel: "低分辨率";
        audioLabel: "无音频";
        watermarkEnabled: true;
      };
    }
  | {
      state: "used" | "unavailable";
      message: string;
      limits: null;
    };

export interface TrialStatusInput {
  userId: string;
  email?: string | null;
  emailVerified?: boolean | null;
  oauthAccounts?: TrialEligibilityInput["oauthAccounts"];
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  now?: Date;
}

type TrialStatusStore = TrialEligibilityStore;

interface TrialStatusDeps {
  store: TrialStatusStore;
  evaluateEligibility?: (input: {
    store: TrialStatusStore;
    input: TrialEligibilityInput;
  }) => Promise<TrialEligibilityResult>;
  input: TrialStatusInput;
}

function createReadOnlyEligibilityStore(
  store: TrialStatusStore,
): TrialEligibilityStore {
  const readOnlyStore: TrialEligibilityStore = {
    ...store,
    async createTrialAbuseSignal() {
      // Status reads must not create trial check/grant/deny signals.
    },
  };

  return readOnlyStore;
}

const availableStatus: TrialStatus = {
  state: "available",
  message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
  limits: {
    durationSeconds: 8,
    qualityLabel: "低分辨率",
    audioLabel: "无音频",
    watermarkEnabled: true,
  },
};

const usedStatus: TrialStatus = {
  state: "used",
  message: "你的免费试用已使用。可以购买点数生成高清无水印视频。",
  limits: null,
};

const unavailableStatus: TrialStatus = {
  state: "unavailable",
  message: "当前账号暂时无法使用免费试用，可以购买点数继续生成。",
  limits: null,
};

export async function getUserVisibleTrialStatus({
  store,
  evaluateEligibility = ({ store: eligibilityStore, input }) =>
    evaluateTrialEligibility({
      store: createReadOnlyEligibilityStore(eligibilityStore),
      input,
      hashSecret: process.env.ABUSE_HASH_SECRET,
      environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    }),
  input,
}: TrialStatusDeps): Promise<TrialStatus> {
  const historicalTrialCount = await store.countTrialUsagesByUserId(input.userId);

  if (historicalTrialCount > 0) {
    return usedStatus;
  }

  const eligibility = await evaluateEligibility({
    store,
    input: {
      userId: input.userId,
      email: input.email,
      emailVerified: input.emailVerified,
      oauthAccounts: input.oauthAccounts,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceFingerprint: input.deviceFingerprint,
      now: input.now,
    },
  });

  return eligibility.decision === "allow" ? availableStatus : unavailableStatus;
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleTrialStatusStore(
  db: DbClient = getDb(),
): TrialEligibilityStore {
  return {
    async countTrialUsagesByUserId(userId) {
      const rows = await db
        .select({ id: freeTrialUsages.id })
        .from(freeTrialUsages)
        .where(eq(freeTrialUsages.userId, userId));

      return rows.length;
    },
    async countTrialUsagesByEmailHash(emailHash) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.emailHash, emailHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
          ),
        );

      return rows.length;
    },
    async countTrialUsagesByOauthAccount(provider, oauthAccountIdHash) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.oauthProvider, provider),
            eq(trialAbuseSignals.oauthAccountIdHash, oauthAccountIdHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
          ),
        );

      return rows.length;
    },
    async countRecentTrialSignalsByDevice(deviceFingerprintHash, since) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.deviceFingerprintHash, deviceFingerprintHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
            gte(trialAbuseSignals.createdAt, since),
          ),
        );

      return rows.length;
    },
    async countRecentTrialSignalsByIp(ipHash, since) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.ipHash, ipHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
            gte(trialAbuseSignals.createdAt, since),
          ),
        );

      return rows.length;
    },
    async countRecentTrialSignalsByIpAndUserAgent(ipHash, userAgentHash, since) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.ipHash, ipHash),
            eq(trialAbuseSignals.userAgentHash, userAgentHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
            gte(trialAbuseSignals.createdAt, since),
          ),
        );

      return rows.length;
    },
    async createTrialAbuseSignal(input: TrialAbuseSignalInput) {
      await db.insert(trialAbuseSignals).values({
        userId: input.userId,
        videoJobId: input.videoJobId ?? null,
        emailHash: input.emailHash ?? null,
        oauthProvider: input.oauthProvider ?? null,
        oauthAccountIdHash: input.oauthAccountIdHash ?? null,
        ipHash: input.ipHash ?? null,
        deviceFingerprintHash: input.deviceFingerprintHash ?? null,
        userAgentHash: input.userAgentHash ?? null,
        eventType: input.eventType,
        decision: input.decision,
        riskScore: input.riskScore,
        reasonCodes: input.reasonCodes,
        metadata: input.metadata ?? null,
        createdAt: input.createdAt,
      });
    },
  };
}
