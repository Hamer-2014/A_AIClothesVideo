// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JobNoteForm } from "./job-note-form";

describe("JobNoteForm", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("posts note JSON to the admin notes endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ note: { id: "note-1" } }), { status: 200 }),
    );

    render(<JobNoteForm endpoint="/api/admin/jobs/job-1/notes" />);

    fireEvent.change(screen.getByPlaceholderText("记录处理判断、账务核对结果或后续动作"), {
      target: { value: "check ledger before release" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加备注" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/jobs/job-1/notes",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: "check ledger before release" }),
        }),
      );
    });
    expect(screen.getByText("备注已写入。刷新页面可查看最新备注。")).toBeInTheDocument();
  });
});
