import { describe, expect, it, vi } from "vitest";

import { handleRightsRemovalRequest } from "./route";

const validRightsRemovalBody = {
  reporterName: "权利人",
  reporterEmail: "owner@example.com",
  rightsType: "likeness",
  contentReferences: ["https://app.example/jobs/job-1?token=secret"],
  description:
    "我是相关人物的合法权利人，该内容未经授权使用了人物肖像，请核验并处理对应内容。此说明仅用于自动化测试。",
  goodFaithConfirmed: true,
  accuracyConfirmed: true,
  companyWebsite: "",
};

describe("POST /api/compliance/rights-removal", () => {
  it("returns a public reference after the case is persisted", async () => {
    const response = await handleRightsRemovalRequest(
      new Request("http://localhost/api/compliance/rights-removal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validRightsRemovalBody),
      }),
      {
        submitRequest: async () => ({
          accepted: true,
          reference: "RR-TEST123",
        }),
      },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: true,
      reference: "RR-TEST123",
    });
  });

  it("accepts honeypot submissions without persisting them", async () => {
    const submitRequest = vi.fn();
    const response = await handleRightsRemovalRequest(
      new Request("http://localhost/api/compliance/rights-removal", {
        method: "POST",
        body: JSON.stringify({
          ...validRightsRemovalBody,
          companyWebsite: "https://spam.example",
        }),
      }),
      { submitRequest },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: true,
      reference: "RR-RECEIVED",
    });
    expect(submitRequest).not.toHaveBeenCalled();
  });

  it("rejects declared and actual bodies larger than 16KB", async () => {
    const submitRequest = vi.fn();
    const declared = await handleRightsRemovalRequest(
      new Request("http://localhost/api/compliance/rights-removal", {
        method: "POST",
        headers: { "content-length": "20000" },
        body: "{}",
      }),
      { submitRequest },
    );
    const actual = await handleRightsRemovalRequest(
      new Request("http://localhost/api/compliance/rights-removal", {
        method: "POST",
        body: JSON.stringify({ description: "权".repeat(6000) }),
      }),
      { submitRequest },
    );

    expect(declared.status).toBe(413);
    expect(actual.status).toBe(413);
    expect(submitRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_rights_removal_input", 400],
    ["rights_removal_rate_limited", 429],
    ["compliance_hash_secret_required", 503],
    ["database unavailable", 503],
  ])("maps %s without exposing internals", async (message, status) => {
    const response = await handleRightsRemovalRequest(
      new Request("http://localhost/api/compliance/rights-removal", {
        method: "POST",
        body: JSON.stringify(validRightsRemovalBody),
      }),
      {
        submitRequest: async () => {
          throw new Error(message);
        },
      },
    );

    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body).not.toHaveProperty("reference");
    expect(JSON.stringify(body)).not.toContain("database unavailable");
  });
});
