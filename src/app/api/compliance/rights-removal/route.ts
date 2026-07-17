import { NextResponse } from "next/server";

import {
  createDrizzleRightsRemovalStore,
  submitRightsRemovalRequest,
} from "@/server/compliance/rights-removal";
import {
  recordRightsRemovalNotificationFailure,
  sendRightsRemovalNotification,
} from "@/server/compliance/rights-removal-email";

const maxBodyBytes = 16 * 1024;

interface RightsRemovalRouteDeps {
  submitRequest?: (input: {
    body: unknown;
    ipAddress: string | null;
    userAgent: string | null;
  }) => Promise<{ accepted: true; reference: string }>;
}

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

function isHoneypotFilled(body: unknown) {
  return Boolean(
    body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof (body as Record<string, unknown>).companyWebsite === "string" &&
      (body as Record<string, string>).companyWebsite.trim(),
  );
}

export async function handleRightsRemovalRequest(
  request: Request,
  deps: RightsRemovalRouteDeps = {},
) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return NextResponse.json(
      { error: "rights_removal_body_too_large" },
      { status: 413 },
    );
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
    return NextResponse.json(
      { error: "rights_removal_body_too_large" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "invalid_rights_removal_input" },
      { status: 400 },
    );
  }

  if (isHoneypotFilled(body)) {
    return NextResponse.json(
      { accepted: true, reference: "RR-RECEIVED" },
      { status: 202 },
    );
  }

  const ipAddress = requestIp(request);
  const userAgent = request.headers.get("user-agent");
  const submitRequest =
    deps.submitRequest ??
    ((input) =>
      submitRightsRemovalRequest({
        store: createDrizzleRightsRemovalStore(),
        input: input.body,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        appEnvironment:
          process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
        hashSecret: process.env.ABUSE_HASH_SECRET,
        notifyLegal: (record) => sendRightsRemovalNotification(record),
        recordNotificationFailure: recordRightsRemovalNotificationFailure,
      }));

  try {
    const result = await submitRequest({ body, ipAddress, userAgent });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "invalid_rights_removal_input") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    if (code === "rights_removal_rate_limited") {
      return NextResponse.json({ error: code }, { status: 429 });
    }
    if (code !== "compliance_hash_secret_required") {
      console.error("rights_removal_submission_failed", {
        errorCode: "rights_removal_unavailable",
      });
    }
    return NextResponse.json(
      { error: "rights_removal_unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  return handleRightsRemovalRequest(request);
}
