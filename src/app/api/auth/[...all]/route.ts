import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

import { getAuth } from "@/lib/auth/config";

function createHandler(method: "GET" | "POST") {
  return async (request: Request) => {
    try {
      const handler = toNextJsHandler(getAuth())[method];
      return await handler(request);
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
