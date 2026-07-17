import { randomBytes, randomUUID } from "node:crypto";

import { and, eq, gte } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { rightsRemovalRequests } from "@/lib/db/schema";
import { hashAbuseSignal } from "@/server/abuse/hash";
import { requireComplianceHashSecret } from "./rights-attestation";

export type RightsType =
  | "likeness"
  | "copyright"
  | "trademark"
  | "privacy"
  | "other";

export interface ParsedRightsRemovalInput {
  reporterName: string;
  reporterEmail: string;
  rightsType: RightsType;
  contentReferences: string[];
  description: string;
  goodFaithConfirmed: true;
  accuracyConfirmed: true;
}

export type RightsRemovalStatus =
  | "received"
  | "triaging"
  | "awaiting_information"
  | "action_required"
  | "resolved_removed"
  | "resolved_rejected";

export interface RightsRemovalRequestRecord extends ParsedRightsRemovalInput {
  id: string;
  publicReference: string;
  status: RightsRemovalStatus;
  ipHash: string | null;
  userAgentHash: string | null;
  resolutionSummary: string | null;
  resolvedAt: Date | null;
  redactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type CreateRightsRemovalRequestInput = Omit<
  RightsRemovalRequestRecord,
  "id"
>;

export interface RightsRemovalStore {
  countRecentByIpHash(input: {
    ipHash: string;
    since: Date;
  }): Promise<number>;
  createRequest(
    input: CreateRightsRemovalRequestInput,
  ): Promise<RightsRemovalRequestRecord>;
}

const rightsTypes = new Set<RightsType>([
  "likeness",
  "copyright",
  "trademark",
  "privacy",
  "other",
]);
const conservativeEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContentReference(value: string) {
  const normalized = value.trim();
  try {
    const url = new URL(normalized);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return normalized.split(/[?#]/, 1)[0]?.slice(0, 500) ?? "";
  }
}

export function parseRightsRemovalInput(
  value: unknown,
): ParsedRightsRemovalInput {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const reporterName =
    typeof input.reporterName === "string" ? input.reporterName.trim() : "";
  const reporterEmail =
    typeof input.reporterEmail === "string"
      ? input.reporterEmail.trim().toLowerCase()
      : "";
  const rightsType = input.rightsType;
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const rawReferences = Array.isArray(input.contentReferences)
    ? input.contentReferences
    : [];
  const contentReferences = Array.from(
    new Set(
      rawReferences
        .filter((reference): reference is string => typeof reference === "string")
        .map(normalizeContentReference)
        .filter(Boolean),
    ),
  );

  if (
    reporterName.length < 2 ||
    reporterName.length > 100 ||
    reporterEmail.length > 254 ||
    !conservativeEmailPattern.test(reporterEmail) ||
    typeof rightsType !== "string" ||
    !rightsTypes.has(rightsType as RightsType) ||
    contentReferences.length < 1 ||
    contentReferences.length > 5 ||
    rawReferences.length !== contentReferences.length ||
    description.length < 50 ||
    description.length > 5000 ||
    input.goodFaithConfirmed !== true ||
    input.accuracyConfirmed !== true
  ) {
    throw new Error("invalid_rights_removal_input");
  }

  return {
    reporterName,
    reporterEmail,
    rightsType: rightsType as RightsType,
    contentReferences,
    description,
    goodFaithConfirmed: true,
    accuracyConfirmed: true,
  };
}

export function createRightsRemovalReference() {
  return `RR-${randomBytes(12).toString("base64url").toUpperCase()}`;
}

function isUniqueReferenceConflict(error: unknown) {
  return (
    (error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505") ||
    (error instanceof Error &&
      error.message.includes("rights_removal_public_reference_unique"))
  );
}

async function createRequestWithUniqueReference({
  store,
  parsed,
  ipHash,
  userAgentHash,
  now,
}: {
  store: RightsRemovalStore;
  parsed: ParsedRightsRemovalInput;
  ipHash: string | null;
  userAgentHash: string | null;
  now: Date;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await store.createRequest({
        ...parsed,
        publicReference: createRightsRemovalReference(),
        status: "received",
        ipHash,
        userAgentHash,
        resolutionSummary: null,
        resolvedAt: null,
        redactedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (!isUniqueReferenceConflict(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("rights_removal_reference_unavailable");
}

export interface SubmitRightsRemovalRequestInput {
  store: RightsRemovalStore;
  input: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  appEnvironment: string;
  hashSecret: string | null | undefined;
  now?: Date;
  notifyLegal: (record: RightsRemovalRequestRecord) => Promise<void>;
  recordNotificationFailure: (input: {
    publicReference: string;
    errorCode: "rights_removal_notification_failed";
    errorMessage: string;
  }) => Promise<void>;
}

export async function submitRightsRemovalRequest({
  store,
  input,
  ipAddress,
  userAgent,
  appEnvironment,
  hashSecret,
  now = new Date(),
  notifyLegal,
  recordNotificationFailure,
}: SubmitRightsRemovalRequestInput) {
  const parsed = parseRightsRemovalInput(input);
  const secret = requireComplianceHashSecret(appEnvironment, hashSecret);
  const ipHash = secret ? hashAbuseSignal(ipAddress, secret) : null;
  const userAgentHash = secret ? hashAbuseSignal(userAgent, secret) : null;

  if (
    ipHash &&
    (await store.countRecentByIpHash({
      ipHash,
      since: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    })) >= 5
  ) {
    throw new Error("rights_removal_rate_limited");
  }

  const record = await createRequestWithUniqueReference({
    store,
    parsed,
    ipHash,
    userAgentHash,
    now,
  });

  try {
    await notifyLegal(record);
  } catch (error) {
    try {
      await recordNotificationFailure({
        publicReference: record.publicReference,
        errorCode: "rights_removal_notification_failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown email error",
      });
    } catch {
      console.error("rights_removal_notification_failure_recording_failed", {
        publicReference: record.publicReference,
      });
    }
  }

  return { accepted: true as const, reference: record.publicReference };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleRightsRemovalStore(
  db: DbClient = getDb(),
): RightsRemovalStore {
  return {
    async countRecentByIpHash({ ipHash, since }) {
      const rows = await db
        .select({ id: rightsRemovalRequests.id })
        .from(rightsRemovalRequests)
        .where(
          and(
            eq(rightsRemovalRequests.ipHash, ipHash),
            gte(rightsRemovalRequests.createdAt, since),
          ),
        );
      return rows.length;
    },
    async createRequest(input) {
      const [record] = await db
        .insert(rightsRemovalRequests)
        .values(input)
        .returning();
      if (!record) {
        throw new Error("rights_removal_persistence_failed");
      }
      return record as RightsRemovalRequestRecord;
    },
  };
}

export function createInMemoryRightsRemovalStore(
  options: {
    requests?: RightsRemovalRequestRecord[];
    recentIpHashCount?: number;
  } = {},
): RightsRemovalStore & {
  listRequests(): RightsRemovalRequestRecord[];
} {
  const requests = (options.requests ?? []).map((request) => ({ ...request }));

  return {
    async countRecentByIpHash({ ipHash, since }) {
      return (
        (options.recentIpHashCount ?? 0) +
        requests.filter(
          (request) => request.ipHash === ipHash && request.createdAt >= since,
        ).length
      );
    },
    async createRequest(input) {
      if (
        requests.some(
          (request) => request.publicReference === input.publicReference,
        )
      ) {
        const error = new Error("rights_removal_public_reference_unique") as Error & {
          code: string;
        };
        error.code = "23505";
        throw error;
      }
      const record = { id: randomUUID(), ...input };
      requests.push(record);
      return record;
    },
    listRequests: () => requests.map((request) => ({ ...request })),
  };
}
