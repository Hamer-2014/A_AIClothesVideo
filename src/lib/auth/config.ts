import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";

import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

import {
  buildMagicLinkEmail,
  buildOtpEmail,
  sendAuthEmail,
  type OtpEmailType,
} from "./email";

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
        async sendVerificationOTP({ email, otp, type }) {
          const content = buildOtpEmail({
            email,
            otp,
            type: type as OtpEmailType,
          });

          await sendAuthEmail({ to: email, content });
        },
      }),
      magicLink({
        async sendMagicLink({ email, url }) {
          const content = buildMagicLinkEmail({ email, url });

          await sendAuthEmail({ to: email, content });
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
