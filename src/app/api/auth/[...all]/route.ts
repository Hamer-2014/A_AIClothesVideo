import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth/config";
import {
  type AuthEmailRateLimitError,
  runWithAuthEmailRateLimitCapture,
} from "@/server/auth/email-rate-limit";

const AUTH_EMAIL_SEND_PATHS = [
  "/email-otp/send-verification-otp",
  "/sign-in/magic-link",
] as const;

function isAuthEmailSendRequest(request: Request) {
  const pathname = new URL(request.url).pathname;
  return AUTH_EMAIL_SEND_PATHS.some((path) => pathname.endsWith(path));
}

function createAuthEmailRateLimitResponse(retryAfterSeconds: number) {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    {
      code: "AUTH_EMAIL_RATE_LIMITED",
      message: "发送过于频繁，请稍后重试。",
      retryAfterSeconds: retryAfter,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}

function getBetterAuthRetryAfter(response: Response) {
  const value =
    response.headers.get("Retry-After") ??
    response.headers.get("X-Retry-After");
  const seconds = value ? Number(value) : Number.NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
}

function normalizeAuthEmailRateLimitResponse(
  request: Request,
  response: Response,
  capturedError: AuthEmailRateLimitError | null,
) {
  if (capturedError) {
    return createAuthEmailRateLimitResponse(capturedError.retryAfterSeconds);
  }
  if (response.status === 429 && isAuthEmailSendRequest(request)) {
    return createAuthEmailRateLimitResponse(getBetterAuthRetryAfter(response));
  }
  return response;
}

function createHandler(method: "GET" | "POST") {
  return async (request: Request) => {
    try {
      const handler = toNextJsHandler(getAuth())[method];
      const { result, rateLimitError } =
        await runWithAuthEmailRateLimitCapture(() => handler(request));
      return normalizeAuthEmailRateLimitResponse(
        request,
        result,
        rateLimitError,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.endsWith("is required for authentication.")
      ) {
        return NextResponse.json(
          { error: "auth_not_configured" },
          { status: 503 },
        );
      }

      throw error;
    }
  };
}

export const GET = createHandler("GET");
export const POST = createHandler("POST");
