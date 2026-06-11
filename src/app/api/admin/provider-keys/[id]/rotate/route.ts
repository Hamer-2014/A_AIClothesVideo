import { NextResponse } from "next/server";

import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";
import {
  createDrizzleProviderOpsStore,
  rotateProviderKey,
} from "@/server/admin/providers";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface RotateProviderKeyDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  rotateKey?: (input: {
    keyId: string;
    plainKey: string;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const plainKey =
    typeof record.plainKey === "string" ? record.plainKey.trim() : "";
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (!plainKey || reason.length < 6) {
    throw new Error("invalid_provider_key_rotate_input");
  }

  return { plainKey, reason };
}

function defaultRotateKey({
  admin,
  request,
  keyId,
  input,
}: {
  admin: AdminSession;
  request: Request;
  keyId: string;
  input: ReturnType<typeof parseBody>;
}) {
  return rotateProviderKey({
    store: createDrizzleProviderOpsStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    keyId,
    plainKey: input.plainKey,
    reason: input.reason,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleRotateProviderKeyRequest(
  request: Request,
  context: { params: { id: string } },
  deps: RotateProviderKeyDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let input: ReturnType<typeof parseBody>;
  try {
    input = parseBody(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json(
      { error: "invalid_provider_key_rotate_input" },
      { status: 400 },
    );
  }

  try {
    const rotateKey =
      deps.rotateKey ??
      ((args: { keyId: string; plainKey: string; reason: string }) =>
        defaultRotateKey({
          admin,
          request,
          keyId: args.keyId,
          input: {
            plainKey: args.plainKey,
            reason: args.reason,
          },
        }));
    const result = await rotateKey({
      keyId: context.params.id,
      ...input,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot rotate provider keys."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message.includes("PROVIDER_KEY_ENCRYPTION_SECRET")
    ) {
      return NextResponse.json(
        { error: "provider_key_encryption_unavailable" },
        { status: 503 },
      );
    }
    if (error instanceof Error && error.message === "Provider key not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (
      error instanceof Error &&
      error.message === "Admin action reason must be at least 6 characters."
    ) {
      return NextResponse.json(
        { error: "invalid_provider_key_rotate_input" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "provider_key_rotate_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRotateProviderKeyRequest(request, {
    params: await context.params,
  });
}
