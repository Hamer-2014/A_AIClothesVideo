// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "./language-switcher";

const navigationMocks = vi.hoisted(() => ({
  pathname: "/pricing",
  search: "package=starter",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
  useSearchParams: () => new URLSearchParams(navigationMocks.search),
}));

describe("LanguageSwitcher", () => {
  afterEach(() => cleanup());

  it("switches an English path to Chinese and preserves its query", () => {
    render(<LanguageSwitcher locale="en" />);

    const switcher = screen.getByRole("link", { name: "Switch to Chinese" });
    expect(switcher).toHaveAttribute(
      "href",
      "/zh/pricing?package=starter",
    );
    expect(switcher).toHaveClass("min-h-11", "min-w-11");
    expect(switcher).toHaveTextContent("ZH");
  });

  it("switches a Chinese path to English", () => {
    render(
      <LanguageSwitcher
        locale="zh-CN"
        pathname="/zh/faq"
        search="topic=upload"
      />,
    );

    expect(
      screen.getByRole("link", { name: "切换到英文" }),
    ).toHaveAttribute("href", "/faq?topic=upload");
  });
});
