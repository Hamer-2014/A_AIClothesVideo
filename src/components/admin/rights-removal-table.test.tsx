// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RightsRemovalRequestRecord } from "@/server/compliance/rights-removal";
import { RightsRemovalTable } from "./rights-removal-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const requestFixture: RightsRemovalRequestRecord = {
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
  ipHash: "ip-hash",
  userAgentHash: "ua-hash",
  resolutionSummary: null,
  resolvedAt: null,
  redactedAt: null,
  createdAt: new Date("2026-07-11T00:00:00.000Z"),
  updatedAt: new Date("2026-07-11T00:00:00.000Z"),
};

describe("RightsRemovalTable", () => {
  it("shows case identity and requires a reason for status changes", () => {
    render(
      <RightsRemovalTable requests={[requestFixture]} actorRole="operator" />,
    );

    expect(screen.getByText("RR-TEST123")).toBeInTheDocument();
    expect(screen.getByText("likeness")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新状态" })).toBeDisabled();
    expect(screen.queryByRole("option", { name: "已删除" })).not.toBeInTheDocument();
    expect(screen.queryByText("ip-hash")).not.toBeInTheDocument();
    expect(screen.queryByText("ua-hash")).not.toBeInTheDocument();
  });

  it("shows final status options only to admins", () => {
    render(
      <RightsRemovalTable
        requests={[{ ...requestFixture, status: "action_required" }]}
        actorRole="admin"
      />,
    );
    expect(screen.getByRole("option", { name: "已删除" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "已驳回" })).toBeInTheDocument();
  });
});
