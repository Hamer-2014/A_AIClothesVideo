// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FaqPage from "@/app/faq/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

describe("public trust pages", () => {
  afterEach(() => {
    cleanup();
  });

  it("privacy explains uploads, model calls, R2, retention, and deletion", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "上传图片" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模型调用" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloudflare R2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "保存周期" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "删除" })).toBeInTheDocument();
  });

  it("terms explains prohibited content, trial limits, failures, refunds, and uploaded assets", () => {
    render(<TermsPage />);

    expect(screen.getByRole("heading", { name: "禁止内容" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "试用限制" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "生成失败" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "退款" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "用户上传素材" })).toBeInTheDocument();
  });

  it("faq answers core trial and material questions", () => {
    render(<FaqPage />);

    expect(screen.getByText(/需要上传什么图片/)).toBeInTheDocument();
    expect(screen.getByText(/为什么不能生成背面/)).toBeInTheDocument();
    expect(screen.getByText(/多久生成/)).toBeInTheDocument();
    expect(screen.getByText(/试用和付费有什么区别/)).toBeInTheDocument();
  });

  it("links FAQ from the public header and footer", () => {
    const { rerender } = render(<PublicHeader />);

    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );

    rerender(<PublicFooter />);

    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );
  });
});
