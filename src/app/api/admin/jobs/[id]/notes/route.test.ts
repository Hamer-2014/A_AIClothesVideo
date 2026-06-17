import { describe, expect, it } from "vitest";

import { handleAddAdminJobNoteRequest } from "./route";

describe("POST /api/admin/jobs/[id]/notes", () => {
  it("requires admin access", async () => {
    const response = await handleAddAdminJobNoteRequest(
      new Request("http://localhost/api/admin/jobs/job-1/notes", {
        method: "POST",
        body: JSON.stringify({ note: "internal note" }),
      }),
      { params: { id: "job-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("creates a note for admins/operators", async () => {
    const response = await handleAddAdminJobNoteRequest(
      new Request("http://localhost/api/admin/jobs/job-1/notes", {
        method: "POST",
        body: JSON.stringify({ note: "check ledger before release" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        addNote: async (input) => ({
          id: "note-1",
          jobId: input.jobId,
          adminUserId: "operator-1",
          note: input.note,
          createdAt: new Date("2026-06-17T00:00:00.000Z"),
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      note: {
        id: "note-1",
        jobId: "job-1",
        adminUserId: "operator-1",
        note: "check ledger before release",
        createdAt: "2026-06-17T00:00:00.000Z",
      },
    });
  });

  it("rejects blank notes", async () => {
    const response = await handleAddAdminJobNoteRequest(
      new Request("http://localhost/api/admin/jobs/job-1/notes", {
        method: "POST",
        body: JSON.stringify({ note: "   " }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
      },
    );

    expect(response.status).toBe(400);
  });
});
