// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminActionForm } from "./action-form";

describe("AdminActionForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows server messages for rejected actions instead of only error codes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "release_credits_not_allowed",
          message: "Video job credits cannot be released in this state.",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <AdminActionForm
        description="Release credits"
        endpoint="/api/admin/jobs/job-1/release-credits"
        submitLabel="释放冻结点数"
        title="释放冻结点数"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("必须填写操作原因，至少 6 个字符"), {
      target: { value: "release failed job" },
    });
    fireEvent.click(screen.getByRole("button", { name: "释放冻结点数" }));

    expect(
      await screen.findByText(
        "操作失败: Video job credits cannot be released in this state.",
      ),
    ).toBeInTheDocument();
  });

  it("sends one stable idempotency key and disables the form after success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ledger: { id: "ledger-1" },
          idempotent: false,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <AdminActionForm
        description="Adjust credits"
        endpoint="/api/admin/credits/adjust"
        fields={[
          { name: "userId", label: "目标用户", defaultValue: "user-1" },
          { name: "amount", label: "补点数量", type: "number", defaultValue: "25" },
        ]}
        idempotencyKey="admin_adjust:test-key"
        submitLabel="手动补点"
        title="补偿点数"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("必须填写操作原因，至少 6 个字符"), {
      target: { value: "manual compensation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "手动补点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/credits/adjust",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      reason: "manual compensation",
      userId: "user-1",
      amount: 25,
      idempotencyKey: "admin_adjust:test-key",
    });
    expect(screen.getByText("已提交。刷新页面可查看最新状态。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手动补点" })).toBeDisabled();
  });

  it("explains idempotent success without looking like a fresh compensation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ledger: { id: "ledger-1" },
          idempotent: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <AdminActionForm
        description="Adjust credits"
        endpoint="/api/admin/credits/adjust"
        idempotencyKey="admin_adjust:test-key"
        submitLabel="手动补点"
        title="补偿点数"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("必须填写操作原因，至少 6 个字符"), {
      target: { value: "manual compensation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "手动补点" }));

    expect(
      await screen.findByText("该操作此前已经处理过，本次没有重复执行。刷新页面可查看最新状态。"),
    ).toBeInTheDocument();
  });
});
