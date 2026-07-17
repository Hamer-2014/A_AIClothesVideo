import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createDrizzleComplianceRetentionStore,
  redactExpiredComplianceData,
} from "@/server/compliance/retention";

interface ComplianceRetentionRouteDeps {
  cronSecret?: string | null;
  runRetention?: () => Promise<{
    removalRequestCount: number;
    attestationCount: number;
  }>;
}

function secretsMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function handleComplianceRetentionRequest(
  request: Request,
  deps: ComplianceRetentionRouteDeps = {},
) {
  const cronSecret = (deps.cronSecret ?? process.env.CRON_JOB_SECRET)?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: "compliance_retention_unavailable" },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!suppliedSecret || !secretsMatch(suppliedSecret, cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await (
      deps.runRetention ??
      (() =>
        redactExpiredComplianceData({
          store: createDrizzleComplianceRetentionStore(),
        }))
    )();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "compliance_retention_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleComplianceRetentionRequest(request);
}
