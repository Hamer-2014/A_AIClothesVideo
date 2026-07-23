// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TakedownForm } from "./takedown-form";

function fillValidRightsRemovalForm() {
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Rights holder" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "owner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Type of right"), {
    target: { value: "likeness" },
  });
  fireEvent.change(screen.getByLabelText("Content references"), {
    target: { value: "https://app.example/jobs/job-1" },
  });
  fireEvent.change(screen.getByLabelText("Description of your rights"), {
    target: {
      value:
        "I am the authorized rights holder. This content uses the person's likeness without permission. Please review and process this notice.",
    },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /good-faith belief/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /accurate and complete/ }));
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
    fireEvent.click(screen.getByRole("button", { name: "Submit rights notice" }));

    expect(await screen.findByText(/RR-TEST123/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "legal@example.com" }),
    ).toHaveAttribute("href", "mailto:legal@example.com");
    expect(screen.queryByText("owner@example.com")).not.toBeInTheDocument();
  });

  it("starts with unchecked declarations and has no attachment input", () => {
    render(<TakedownForm legalContactEmail="legal@example.com" />);

    expect(
      screen.getByRole("checkbox", { name: /good-faith belief/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /accurate and complete/ }),
    ).not.toBeChecked();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
