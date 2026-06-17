import { NextResponse } from "next/server";

import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";
import {
  addAdminJobNote,
  createDrizzleAdminJobNoteStore,
} from "@/server/admin/job-notes";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface AddAdminJobNoteDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  addNote?: (input: { jobId: string; note: string }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const note = typeof record.note === "string" ? record.note.trim() : "";

  if (!note) {
    throw new Error("invalid_job_note_input");
  }

  return { note };
}

function defaultAddNote({
  admin,
  request,
  jobId,
  note,
}: {
  admin: AdminSession;
  request: Request;
  jobId: string;
  note: string;
}) {
  return addAdminJobNote({
    store: createDrizzleAdminJobNoteStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    jobId,
    note,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleAddAdminJobNoteRequest(
  request: Request,
  context: { params: { id: string } },
  deps: AddAdminJobNoteDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let input: ReturnType<typeof parseBody>;
  try {
    input = parseBody(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "invalid_job_note_input" }, { status: 400 });
  }

  try {
    const note = await (deps.addNote ??
      ((args) => defaultAddNote({ admin, request, ...args })))({
      jobId: context.params.id,
      note: input.note,
    });
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof Error && error.message === "Actor cannot add job notes.") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message === "Admin job note cannot be empty."
    ) {
      return NextResponse.json({ error: "invalid_job_note_input" }, { status: 400 });
    }

    return NextResponse.json({ error: "add_job_note_failed" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleAddAdminJobNoteRequest(request, {
    params: await context.params,
  });
}
