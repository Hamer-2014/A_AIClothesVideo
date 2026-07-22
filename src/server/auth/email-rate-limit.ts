import { AsyncLocalStorage } from "node:async_hooks";

import { and, eq, gte, or, sql } from "drizzle-orm";

import { sendAuthEmail, type AuthEmailContent } from "@/lib/auth/email";
import { getDb } from "@/lib/db/client";
import { authEmailEvents } from "@/lib/db/schema";

export const AUTH_EMAIL_RATE_LIMIT = {
  emailCooldownSeconds: 60,
  emailHourlyMax: 5,
  ipWindowSeconds: 10 * 60,
  ipWindowMax: 10,
} as const;

export type AuthEmailEventType =
  | "sign_in_otp"
  | "magic_link"
  | "email_verification";

export interface AuthEmailAttemptSnapshot {
  email: string;
  ipAddress: string | null;
  createdAt: Date;
}

export type AuthEmailRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface AuthEmailEventStore {
  reserve(input: {
    email: string;
    type: AuthEmailEventType;
    ipAddress: string | null;
    userAgent: string | null;
    now: Date;
  }): Promise<{ id: string }>;
  markSent(input: { id: string; providerMessageId: string | null }): Promise<void>;
  markFailed(input: { id: string; errorMessage: string }): Promise<void>;
}

export class AuthEmailRateLimitError extends Error {
  readonly code = "AUTH_EMAIL_RATE_LIMITED";

  constructor(readonly retryAfterSeconds: number) {
    super("auth_email_rate_limited");
  }
}

interface AuthEmailRateLimitContext {
  error: AuthEmailRateLimitError | null;
}

const authEmailRateLimitContext =
  new AsyncLocalStorage<AuthEmailRateLimitContext>();

export function recordAuthEmailRateLimitError(error: AuthEmailRateLimitError) {
  const context = authEmailRateLimitContext.getStore();
  if (context) context.error = error;
}

export async function runWithAuthEmailRateLimitCapture<T>(
  operation: () => Promise<T>,
) {
  const context: AuthEmailRateLimitContext = { error: null };
  const result = await authEmailRateLimitContext.run(context, operation);
  return { result, rateLimitError: context.error };
}

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAuthEmailRequestMeta(request?: Request) {
  const forwardedFor = request?.headers.get("x-forwarded-for");

  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent")?.slice(0, 500) || null,
  };
}

export function buildAuthEmailLockKeys(
  email: string,
  ipAddress: string | null,
) {
  return [
    `auth-email:email:${email}`,
    ...(ipAddress ? [`auth-email:ip:${ipAddress}`] : []),
  ].sort();
}

function retryAfter(createdAt: Date, windowSeconds: number, now: Date) {
  return Math.max(
    1,
    Math.ceil(
      (createdAt.getTime() + windowSeconds * 1000 - now.getTime()) / 1000,
    ),
  );
}

export function evaluateAuthEmailRateLimit(input: {
  email: string;
  ipAddress: string | null;
  now: Date;
  attempts: AuthEmailAttemptSnapshot[];
}): AuthEmailRateLimitDecision {
  const emailAttempts = input.attempts
    .filter((attempt) => attempt.email === input.email)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latestEmailAttempt = emailAttempts[0];

  if (
    latestEmailAttempt &&
    latestEmailAttempt.createdAt.getTime() >
      input.now.getTime() - AUTH_EMAIL_RATE_LIMIT.emailCooldownSeconds * 1000
  ) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfter(
        latestEmailAttempt.createdAt,
        AUTH_EMAIL_RATE_LIMIT.emailCooldownSeconds,
        input.now,
      ),
    };
  }

  const hourlyEmailAttempts = emailAttempts.filter(
    (attempt) =>
      attempt.createdAt.getTime() > input.now.getTime() - 60 * 60 * 1000,
  );
  if (hourlyEmailAttempts.length >= AUTH_EMAIL_RATE_LIMIT.emailHourlyMax) {
    const thresholdAttempt =
      hourlyEmailAttempts[AUTH_EMAIL_RATE_LIMIT.emailHourlyMax - 1];
    return {
      allowed: false,
      retryAfterSeconds: retryAfter(thresholdAttempt.createdAt, 60 * 60, input.now),
    };
  }

  if (input.ipAddress) {
    const ipAttempts = input.attempts
      .filter(
        (attempt) =>
          attempt.ipAddress === input.ipAddress &&
          attempt.createdAt.getTime() >
            input.now.getTime() - AUTH_EMAIL_RATE_LIMIT.ipWindowSeconds * 1000,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (ipAttempts.length >= AUTH_EMAIL_RATE_LIMIT.ipWindowMax) {
      const thresholdAttempt =
        ipAttempts[AUTH_EMAIL_RATE_LIMIT.ipWindowMax - 1];
      return {
        allowed: false,
        retryAfterSeconds: retryAfter(
          thresholdAttempt.createdAt,
          AUTH_EMAIL_RATE_LIMIT.ipWindowSeconds,
          input.now,
        ),
      };
    }
  }

  return { allowed: true };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAuthEmailEventStore(
  db: DbClient = getDb(),
): AuthEmailEventStore {
  return {
    async reserve(input) {
      return db.transaction(async (tx) => {
        for (const key of buildAuthEmailLockKeys(input.email, input.ipAddress)) {
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${key}))`,
          );
        }

        const since = new Date(input.now.getTime() - 60 * 60 * 1000);
        const subjectCondition = input.ipAddress
          ? or(
              eq(authEmailEvents.email, input.email),
              eq(authEmailEvents.ipAddress, input.ipAddress),
            )
          : eq(authEmailEvents.email, input.email);
        const attempts = await tx
          .select({
            email: authEmailEvents.email,
            ipAddress: authEmailEvents.ipAddress,
            createdAt: authEmailEvents.createdAt,
          })
          .from(authEmailEvents)
          .where(and(gte(authEmailEvents.createdAt, since), subjectCondition));
        const decision = evaluateAuthEmailRateLimit({
          email: input.email,
          ipAddress: input.ipAddress,
          now: input.now,
          attempts,
        });

        if (!decision.allowed) {
          throw new AuthEmailRateLimitError(decision.retryAfterSeconds);
        }

        const [reservation] = await tx
          .insert(authEmailEvents)
          .values({
            email: input.email,
            type: input.type,
            status: "pending",
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            createdAt: input.now,
          })
          .returning({ id: authEmailEvents.id });

        if (!reservation) {
          throw new Error("auth_email_reservation_failed");
        }

        return reservation;
      });
    },
    async markSent(input) {
      await db
        .update(authEmailEvents)
        .set({
          status: "sent",
          providerMessageId: input.providerMessageId,
          errorMessage: null,
        })
        .where(eq(authEmailEvents.id, input.id));
    },
    async markFailed(input) {
      await db
        .update(authEmailEvents)
        .set({
          status: "failed",
          errorMessage: input.errorMessage.slice(0, 1000),
        })
        .where(eq(authEmailEvents.id, input.id));
    },
  };
}

export async function deliverRateLimitedAuthEmail(input: {
  store?: AuthEmailEventStore;
  email: string;
  type: AuthEmailEventType;
  content: AuthEmailContent;
  request?: Request;
  now?: Date;
  send?: typeof sendAuthEmail;
}) {
  const store = input.store ?? createDrizzleAuthEmailEventStore();
  const send = input.send ?? sendAuthEmail;
  const email = normalizeAuthEmail(input.email);
  const requestMeta = getAuthEmailRequestMeta(input.request);
  const reservation = await store.reserve({
    email,
    type: input.type,
    ...requestMeta,
    now: input.now ?? new Date(),
  });

  try {
    const result = await send({ to: email, content: input.content });
    try {
      await store.markSent({
        id: reservation.id,
        providerMessageId: result.providerMessageId,
      });
    } catch (recordingError) {
      console.error("auth_email_success_recording_failed", {
        reservationId: reservation.id,
        recordingError,
      });
    }
    return result;
  } catch (error) {
    try {
      await store.markFailed({
        id: reservation.id,
        errorMessage: error instanceof Error ? error.message : "Unknown email error",
      });
    } catch (recordingError) {
      console.error("auth_email_failure_recording_failed", {
        reservationId: reservation.id,
        recordingError,
      });
    }
    throw error;
  }
}
