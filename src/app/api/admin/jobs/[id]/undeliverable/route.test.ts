import { describe, expect, it } from "vitest";

import {
  grantTrialCredits,
  releaseReservedCredits,
  reserveCredits,
} from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryAdminAuditStore } from "@/server/admin/audit";
import {
  createInMemoryAdminJobActionStore,
  markJobUndeliverable,
} from "@/server/admin/job-actions";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import { handleMarkUndeliverableRequest } from "./route";

describe("POST /api/admin/jobs/[id]/undeliverable", () => {
  it("requires admin access", async () => {
    const response = await handleMarkUndeliverableRequest(
      new Request("http://localhost/api/admin/jobs/job-1/undeliverable", {
        method: "POST",
        body: JSON.stringify({ reason: "cannot recover" }),
      }),
      { params: { id: "job-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("marks a job undeliverable", async () => {
    const calls: Array<{ jobId: string; reason: string }> = [];
    const response = await handleMarkUndeliverableRequest(
      new Request("http://localhost/api/admin/jobs/job-1/undeliverable", {
        method: "POST",
        body: JSON.stringify({ reason: "cannot recover" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        releaseCredits: async (input) => {
          calls.push(input);
          return {
            jobId: input.jobId,
            status: "failed_released",
            ledgerType: "release",
            idempotent: false,
          };
        },
      },
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([{ jobId: "job-1", reason: "cannot recover" }]);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      status: "failed_released",
      ledgerType: "release",
      idempotent: false,
    });
  });

  it("rejects missing, whitespace-only, and short reasons", async () => {
    for (const reason of ["", "   ", "short"]) {
      const response = await handleMarkUndeliverableRequest(
        new Request("http://localhost/api/admin/jobs/job-1/undeliverable", {
          method: "POST",
          body: JSON.stringify({ reason }),
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
    }
  });

  it("maps release credit guardrail failures to 409", async () => {
    const guardedErrors = [
      "Video job reserved credits are already resolved.",
      "Video job has no reserved ledger to release.",
      "Video job has no paid credits to release.",
      "Video job credits cannot be released in this state.",
    ];

    for (const message of guardedErrors) {
      const response = await handleMarkUndeliverableRequest(
        new Request("http://localhost/api/admin/jobs/job-1/undeliverable", {
          method: "POST",
          body: JSON.stringify({ reason: "cannot recover" }),
        }),
        { params: { id: "job-1" } },
        {
          getAdminSession: async () => ({
            userId: "operator-1",
            email: "operator@example.com",
            role: "operator",
          }),
          releaseCredits: async () => {
            throw new Error(message);
          },
        },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "release_credits_not_allowed",
        message,
      });
    }
  });

  it("rejects already released jobs through the default undeliverable service path", async () => {
    const userId = "22222222-2222-4222-8222-222222222222";
    const jobId = "33333333-3333-4333-8333-333333333333";
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 100,
      reason: "setup",
      idempotencyKey: "grant:route-undeliverable-release",
    });
    const reserve = await reserveCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "reserve",
      idempotencyKey: `reserve:job:${jobId}:route-undeliverable-release`,
      relatedJobId: jobId,
    });
    await releaseReservedCredits({
      store: creditStore,
      userId,
      amount: 70,
      reason: "already released",
      idempotencyKey: `admin_release:job:${jobId}`,
      relatedJobId: jobId,
    });

    const response = await handleMarkUndeliverableRequest(
      new Request(`http://localhost/api/admin/jobs/${jobId}/undeliverable`, {
        method: "POST",
        body: JSON.stringify({ reason: "cannot recover" }),
      }),
      { params: { id: jobId } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        releaseCredits: (input) =>
          markJobUndeliverable({
            jobStore: createInMemoryJobStore([
              {
                id: jobId,
                userId,
                status: "failed_released",
                lockedBy: null,
                lockedUntil: null,
                attemptCount: 1,
                lastError: "provider failed",
              },
            ]),
            actionStore: createInMemoryAdminJobActionStore([
              {
                id: jobId,
                userId,
                status: "failed_released",
                creditCost: 70,
                reservedLedgerId: reserve.ledger.id,
                failureReason: "provider failed",
              },
            ], [
              { id: reserve.ledger.id, type: "reserve", relatedJobId: jobId },
              { id: "ledger-release", type: "release", relatedJobId: jobId },
            ]),
            creditStore,
            auditStore: createInMemoryAdminAuditStore(),
            actor: {
              userId: "operator-1",
              email: "operator@example.com",
              role: "operator",
            },
            jobId: input.jobId,
            reason: input.reason,
          }),
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "release_credits_not_allowed",
      message: "Video job reserved credits are already resolved.",
    });
    expect(creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
      "release",
    ]);
  });
});
