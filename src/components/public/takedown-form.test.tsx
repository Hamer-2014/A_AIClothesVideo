// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TakedownForm } from "./takedown-form";

function fillValidRightsRemovalForm() {
  fireEvent.change(screen.getByLabelText("举报人姓名"), {
    target: { value: "权利人" },
  });
  fireEvent.change(screen.getByLabelText("联系邮箱"), {
    target: { value: "owner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("权利类型"), {
    target: { value: "likeness" },
  });
  fireEvent.change(screen.getByLabelText("涉及内容"), {
    target: { value: "https://app.example/jobs/job-1" },
  });
  fireEvent.change(screen.getByLabelText("权利说明"), {
    target: {
      value:
        "我是相关人物的合法权利人，该内容未经授权使用了人物肖像，请核验并处理对应内容。此说明仅用于自动化测试。",
    },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /诚信声明/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /准确性声明/ }));
}

describe("TakedownForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a rights notice and shows only its public reference", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ accepted: true, reference: "RR-TEST123" }),
        { status: 202, headers: { "content-type": "application/json" } },
      ),
    );
    render(<TakedownForm legalContactEmail="legal@example.com" />);
    fillValidRightsRemovalForm();
    fireEvent.click(screen.getByRole("button", { name: "提交权利通知" }));

    expect(await screen.findByText(/RR-TEST123/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "legal@example.com" }),
    ).toHaveAttribute("href", "mailto:legal@example.com");
    expect(screen.queryByText("owner@example.com")).not.toBeInTheDocument();
  });

  it("starts with unchecked declarations and has no attachment input", () => {
    render(<TakedownForm legalContactEmail="legal@example.com" />);

    expect(
      screen.getByRole("checkbox", { name: /诚信声明/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /准确性声明/ }),
    ).not.toBeChecked();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
