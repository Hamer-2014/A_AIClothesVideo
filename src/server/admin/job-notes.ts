import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { adminJobNotes } from "@/lib/db/schema";
import type { AdminSession } from "@/server/auth/admin-session";

import {
  type AdminAuditRequestMeta,
  type AdminAuditStore,
  writeAdminAuditLog,
} from "./audit";

export interface AdminJobNoteRecord {
  id: string;
  jobId: string;
  adminUserId: string;
  note: string;
  createdAt: Date;
}

export interface AdminJobNoteStore {
  createNote(input: {
    jobId: string;
    adminUserId: string;
    note: string;
  }): Promise<AdminJobNoteRecord>;
  listNotes(jobId: string): Promise<AdminJobNoteRecord[]>;
}

function normalizeNote(note: string) {
  const normalized = note.trim();
  if (!normalized) {
    throw new Error("Admin job note cannot be empty.");
  }
  return normalized;
}

function assertCanAddNote(actor: Pick<AdminSession, "role"> | { role: string }) {
  if (actor.role !== "admin" && actor.role !== "operator") {
    throw new Error("Actor cannot add job notes.");
  }
}

export async function addAdminJobNote({
  store,
  auditStore,
  actor,
  jobId,
  note,
  requestMeta,
}: {
  store: AdminJobNoteStore;
  auditStore: AdminAuditStore;
  actor: Pick<AdminSession, "userId" | "email" | "role"> | {
    userId: string;
    email: string;
    role: string;
  };
  jobId: string;
  note: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  assertCanAddNote(actor);
  const normalizedNote = normalizeNote(note);

  const created = await store.createNote({
    jobId,
    adminUserId: actor.userId,
    note: normalizedNote,
  });

  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "job:add_note",
    targetType: "video_job",
    targetId: jobId,
    reason: "admin job note",
    afterSnapshot: {
      noteId: created.id,
      note: created.note,
    },
    requestMeta,
  });

  return created;
}

export function listAdminJobNotes({
  store,
  jobId,
}: {
  store: AdminJobNoteStore;
  jobId: string;
}) {
  return store.listNotes(jobId);
}

export function createInMemoryAdminJobNoteStore(): AdminJobNoteStore & {
  listAllNotes(): AdminJobNoteRecord[];
} {
  const records: AdminJobNoteRecord[] = [];
  let sequence = 0;

  return {
    async createNote(input) {
      sequence += 1;
      const record: AdminJobNoteRecord = {
        id: randomUUID(),
        jobId: input.jobId,
        adminUserId: input.adminUserId,
        note: input.note,
        createdAt: new Date(Date.now() + sequence),
      };
      records.push(record);
      return { ...record };
    },
    async listNotes(jobId) {
      return records
        .filter((record) => record.jobId === jobId)
        .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((record) => ({ ...record }));
    },
    listAllNotes() {
      return records.map((record) => ({ ...record }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminJobNoteStore(
  db: DbClient = getDb(),
): AdminJobNoteStore {
  return {
    async createNote(input) {
      const [record] = await db
        .insert(adminJobNotes)
        .values({
          jobId: input.jobId,
          adminUserId: input.adminUserId,
          note: input.note,
        })
        .returning();

      if (!record) {
        throw new Error("Failed to create admin job note.");
      }

      return record as AdminJobNoteRecord;
    },
    async listNotes(jobId) {
      const rows = await db
        .select()
        .from(adminJobNotes)
        .where(eq(adminJobNotes.jobId, jobId))
        .orderBy(desc(adminJobNotes.createdAt));

      return rows as AdminJobNoteRecord[];
    },
  };
}
