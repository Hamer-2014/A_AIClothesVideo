// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplateSlotEditor } from "./template-slot-editor";

describe("TemplateSlotEditor", () => {
  afterEach(() => cleanup());

  it("renders one controlled selector per ordered segment", () => {
    const onChange = vi.fn();
    const slots = ["a", "b", "c", "a", "b"];
    render(
      <TemplateSlotEditor
        onChange={onChange}
        options={[
          { templateId: "a", label: "镜头 A" },
          { templateId: "b", label: "镜头 B" },
          { templateId: "c", label: "镜头 C" },
        ]}
        slots={slots}
      />,
    );

    expect(screen.getAllByRole("combobox", { name: /镜头 [1-5]/ })).toHaveLength(5);
    fireEvent.change(screen.getByRole("combobox", { name: "镜头 3" }), {
      target: { value: "b" },
    });
    expect(onChange).toHaveBeenCalledWith(["a", "b", "b", "a", "b"]);
  });
});
