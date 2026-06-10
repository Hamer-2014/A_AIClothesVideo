import { describe, expect, it } from "vitest";

import {
  buildAdminNav,
  buildDashboardNav,
  buildTemplateStatusRows,
  groupProviderKeysByProvider,
  pickWorkspaceRedirect,
} from "./app-shell";

describe("app shell helpers", () => {
  it("redirects logged-in users to workspace and visitors to login", () => {
    expect(pickWorkspaceRedirect(null)).toBe("/login");
    expect(
      pickWorkspaceRedirect({
        user: {
          id: "user-1",
        },
      }),
    ).toBe("/workspace");
  });

  it("marks the active user dashboard nav item", () => {
    expect(buildDashboardNav("/jobs")).toEqual([
      { href: "/workspace", label: "工作台", active: false },
      { href: "/jobs", label: "任务", active: true },
      { href: "/billing", label: "账单", active: false },
    ]);
  });

  it("marks the active admin nav item", () => {
    expect(buildAdminNav("/admin/providers")).toEqual([
      { href: "/admin", label: "总览", active: false },
      { href: "/admin/jobs", label: "任务", active: false },
      { href: "/admin/providers", label: "供应商", active: true },
      { href: "/admin/billing", label: "点数", active: false },
      { href: "/admin/templates", label: "模板", active: false },
    ]);
  });

  it("groups provider keys under their provider id", () => {
    const grouped = groupProviderKeysByProvider({
      providers: [{ id: "provider-1", displayName: "Creem" }],
      keys: [
        {
          id: "key-1",
          providerId: "provider-1",
          label: "prod",
        },
      ],
    });

    expect(grouped).toEqual([
      {
        providerId: "provider-1",
        providerName: "Creem",
        keys: [{ id: "key-1", providerId: "provider-1", label: "prod" }],
      },
    ]);
  });

  it("merges seeded templates with persisted status overrides", () => {
    const rows = buildTemplateStatusRows([
      {
        templateId: "front_push_in",
        version: 1,
        displayName: "正面慢推近",
        riskLevel: "low",
        status: "active",
        isTrialAllowed: true,
      },
      {
        templateId: "front_pan",
        version: 1,
        displayName: "正面轻微平移",
        riskLevel: "low",
        status: "active",
        isTrialAllowed: true,
      },
    ], [
      {
        templateId: "front_pan",
        version: 1,
        displayName: "正面轻微平移",
        riskLevel: "low",
        status: "paused",
        isTrialAllowed: true,
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        templateId: "front_pan",
        status: "paused",
      }),
      expect.objectContaining({
        templateId: "front_push_in",
        status: "active",
      }),
    ]);
  });
});
