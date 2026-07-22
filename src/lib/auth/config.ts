import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import {
  AuthEmailRateLimitError,
  deliverRateLimitedAuthEmail,
  recordAuthEmailDeliveryError,
  recordAuthEmailRateLimitError,
} from "@/server/auth/email-rate-limit";

import { buildOtpEmail, type OtpEmailType } from "./email";

async function deliverOrThrowApiError(
  input: Parameters<typeof deliverRateLimitedAuthEmail>[0],
) {
  try {
    return await deliverRateLimitedAuthEmail(input);
  } catch (error) {
    if (error instanceof AuthEmailRateLimitError) {
      recordAuthEmailRateLimitError(error);
      throw new APIError(
        "TOO_MANY_REQUESTS",
        {
          code: error.code,
          message: "发送过于频繁，请稍后重试。",
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { "Retry-After": String(error.retryAfterSeconds) },
      );
    }

    recordAuthEmailDeliveryError(error);
    throw error;
  }
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    if (process.env.NODE_ENV === "test") {
      return `__test_${name}__`;
    }

    throw new Error(`${name} is required for authentication.`);
  }

  return value;
}

export function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
    secret: getRequiredEnv("BETTER_AUTH_SECRET"),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        ...schema,
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: false,
    },
    rateLimit: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
        clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
        scope: ["email", "profile"],
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        resendStrategy: "reuse",
        overrideDefaultEmailVerification: true,
        rateLimit: { window: 60, max: 3 },
        async sendVerificationOTP({ email, otp, type }, ctx) {
          const content = buildOtpEmail({
            email,
            otp,
            type: type as OtpEmailType,
          });

          await deliverOrThrowApiError({
            email,
            type:
              type === "email-verification"
                ? "email_verification"
                : "sign_in_otp",
            content,
            request: ctx?.request,
          });
        },
      }),
    ],
  });
}

let cachedAuth: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!cachedAuth) {
    cachedAuth = createAuth();
  }

  return cachedAuth;
}
