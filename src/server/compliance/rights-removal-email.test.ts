import { describe, expect, it, vi } from "vitest";

import {
  getRightsRemovalEmailConfig,
  sendRightsRemovalNotification,
} from "./rights-removal-email";
import type { RightsRemovalRequestRecord } from "./rights-removal";

const request: RightsRemovalRequestRecord = {
  id: "request-1",
  publicReference: "RR-TEST123",
  status: "received",
  reporterName: "权利人",
  reporterEmail: "owner@example.com",
  rightsType: "likeness",
  contentReferences: ["https://app.example/jobs/job-1"],
  description:
    "我是相关人物的合法权利人，该内容未经授权使用了人物肖像，请核验并处理对应内容。此说明仅用于自动化测试。",
  goodFaithConfirmed: true,
  accuracyConfirmed: true,
  ipHash: "private-ip-hash",
  userAgentHash: "private-user-agent-hash",
  resolutionSummary: null,
  resolvedAt: null,
  redactedAt: null,
  createdAt: new Date("2026-07-11T00:00:00.000Z"),
  updatedAt: new Date("2026-07-11T00:00:00.000Z"),
};

describe("rights removal email", () => {
  it("requires Resend, sender, and legal inbox configuration", () => {
    expect(() => getRightsRemovalEmailConfig({})).toThrow(
      "rights_removal_email_config_required",
    );
  });

  it("sends only the public case summary without abuse hashes", async () => {
    const sendEmail = vi.fn().mockResolvedValue({ id: "email-1" });

    await sendRightsRemovalNotification(request, {
      env: {
        RESEND_API_KEY: "resend-key",
        EMAIL_FROM: "RunwayTools <legal@example.com>",
        LEGAL_CONTACT_EMAIL: "legal@example.com",
        APP_URL: "https://app.example",
      },
      sendEmail,
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "RunwayTools <legal@example.com>",
        to: ["legal@example.com"],
        subject: expect.stringMatching(/^\[AI Clothes Video 权利通知\].*RR-TEST123$/),
        text: expect.stringContaining(
          "https://app.example/admin/rights-removal",
        ),
      }),
    );
    const payload = JSON.stringify(sendEmail.mock.calls[0]?.[0]);
    expect(payload).toContain("https://app.example/jobs/job-1");
    expect(payload).not.toContain("private-ip-hash");
    expect(payload).not.toContain("private-user-agent-hash");
    expect(payload).not.toContain("owner@example.com");
    expect(payload).not.toContain(request.description);
  });
});
