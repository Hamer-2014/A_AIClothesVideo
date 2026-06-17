import { describe, expect, it } from "vitest";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  addAdminJobNote,
  createInMemoryAdminJobNoteStore,
  listAdminJobNotes,
} from "./job-notes";

const operator = {
  userId: "operator-1",
  email: "operator@example.com",
  role: "operator" as const,
};

describe("admin job notes", () => {
  it("creates and lists internal notes newest first", async () => {
    const store = createInMemoryAdminJobNoteStore();
    const auditStore = createInMemoryAdminAuditStore();

    await addAdminJobNote({
      store,
      auditStore,
      actor: operator,
      jobId: "job-1",
      note: "first operator note",
    });
    await addAdminJobNote({
      store,
      auditStore,
      actor: operator,
      jobId: "job-1",
      note: "second operator note",
    });
    await addAdminJobNote({
      store,
      auditStore,
      actor: operator,
      jobId: "job-2",
      note: "other job note",
    });

    const notes = await listAdminJobNotes({ store, jobId: "job-1" });

    expect(notes.map((note) => note.note)).toEqual([
      "second operator note",
      "first operator note",
    ]);
  });

  it("writes admin audit log whenever a note is created", async () => {
    const store = createInMemoryAdminJobNoteStore();
    const auditStore = createInMemoryAdminAuditStore();

    const note = await addAdminJobNote({
      store,
      auditStore,
      actor: operator,
      jobId: "job-1",
      note: "check release eligibility before touching ledger",
      requestMeta: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    });

    expect(note).toMatchObject({
      jobId: "job-1",
      adminUserId: "operator-1",
      note: "check release eligibility before touching ledger",
    });
    expect(auditStore.listAuditLogs()).toEqual([
      expect.objectContaining({
        action: "job:add_note",
        targetType: "video_job",
        targetId: "job-1",
        reason: "admin job note",
        afterSnapshot: expect.objectContaining({
          noteId: note.id,
          note: "check release eligibility before touching ledger",
        }),
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      }),
    ]);
  });

  it("rejects actors outside admin/operator roles and blank notes", async () => {
    const store = createInMemoryAdminJobNoteStore();
    const auditStore = createInMemoryAdminAuditStore();

    await expect(
      addAdminJobNote({
        store,
        auditStore,
        actor: { userId: "viewer-1", email: "viewer@example.com", role: "viewer" },
        jobId: "job-1",
        note: "not allowed",
      }),
    ).rejects.toThrow("Actor cannot add job notes.");

    await expect(
      addAdminJobNote({
        store,
        auditStore,
        actor: operator,
        jobId: "job-1",
        note: "   ",
      }),
    ).rejects.toThrow("Admin job note cannot be empty.");
  });
});
