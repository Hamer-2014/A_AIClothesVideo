// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GuideArticlePage, {
  generateMetadata as generateArticleMetadata,
  generateStaticParams,
} from "./[slug]/page";
import GuidesIndexPage, {
  generateMetadata as generateIndexMetadata,
} from "./page";

const mocks = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: mocks.getRequestLocale,
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/guides",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

describe("bilingual guide pages", () => {
  beforeEach(() => {
    mocks.getRequestLocale.mockResolvedValue("en");
    mocks.getServerSession.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("publishes an English-first guide index with three discoverable articles", async () => {
    render(await GuidesIndexPage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Make better clothing videos before you press generate",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Can you make a clothing video without a back image?" }))
      .toHaveAttribute("href", "/guides/clothing-video-without-back-image");
    expect(screen.getByRole("link", { name: "Should a clothing product video be 8, 16, or 24 seconds?" }))
      .toHaveAttribute("href", "/guides/choose-clothing-video-length");
    expect(screen.getByRole("link", { name: "Why do AI clothing videos deform or drift?" }))
      .toHaveAttribute("href", "/guides/why-ai-clothing-videos-deform");
    expect(screen.getByRole("link", { name: "Start with the three-image workflow" }))
      .toHaveAttribute("href", "/three-images-to-clothing-video");
  });

  it("renders the Chinese guide index with localized destinations", async () => {
    mocks.getRequestLocale.mockResolvedValue("zh-CN");

    render(await GuidesIndexPage());

    expect(screen.getByRole("heading", { level: 1, name: "点击生成前，先把服装视频做对" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "没有背面图可以生成服装视频吗？" }))
      .toHaveAttribute("href", "/zh/guides/clothing-video-without-back-image");
    expect(screen.getByRole("link", { name: "先了解三图生成流程" }))
      .toHaveAttribute("href", "/zh/three-images-to-clothing-video");
  });

  it("renders an English article with upward, lateral, and conversion links", async () => {
    render(await GuideArticlePage({
      params: Promise.resolve({ slug: "clothing-video-without-back-image" }),
    }));

    expect(screen.getByRole("heading", { level: 1, name: "Can you make a clothing video without a back image?" }))
      .toBeInTheDocument();
    expect(screen.getByText(/Not if the video needs to show the real back/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See how the three-image workflow defines available shots" }))
      .toHaveAttribute("href", "/three-images-to-clothing-video");

    const related = screen.getByRole("navigation", { name: "Continue preparing this SKU" });
    expect(within(related).getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Start with three matched images" }))
      .toHaveAttribute("href", "/workspace?mode=trial&preset=minimal_studio");
  });

  it("renders the Chinese article and localizes every structural destination", async () => {
    mocks.getRequestLocale.mockResolvedValue("zh-CN");

    render(await GuideArticlePage({
      params: Promise.resolve({ slug: "why-ai-clothing-videos-deform" }),
    }));

    expect(screen.getByRole("heading", { level: 1, name: "AI 服装视频为什么会变形或漂移？" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看三图流程中的素材证据规则" }))
      .toHaveAttribute("href", "/zh/three-images-to-clothing-video");
    expect(screen.getByRole("link", { name: "用三张同款素材开始生成" }))
      .toHaveAttribute("href", "/zh/workspace?mode=trial&preset=minimal_studio");

    const related = screen.getByRole("navigation", { name: "在下一次生成前继续减少不确定性" });
    for (const link of within(related).getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/zh\/guides\//);
    }
  });

  it("publishes static params and symmetric English/Chinese metadata", async () => {
    expect(generateStaticParams()).toEqual([
      { slug: "clothing-video-without-back-image" },
      { slug: "choose-clothing-video-length" },
      { slug: "why-ai-clothing-videos-deform" },
    ]);

    expect(await generateIndexMetadata()).toMatchObject({
      alternates: {
        canonical: "/guides",
        languages: {
          en: "/guides",
          "zh-CN": "/zh/guides",
          "x-default": "/guides",
        },
      },
    });

    const englishMetadata = await generateArticleMetadata({
      params: Promise.resolve({ slug: "choose-clothing-video-length" }),
    });
    expect(englishMetadata).toMatchObject({
      alternates: {
        canonical: "/guides/choose-clothing-video-length",
        languages: {
          en: "/guides/choose-clothing-video-length",
          "zh-CN": "/zh/guides/choose-clothing-video-length",
          "x-default": "/guides/choose-clothing-video-length",
        },
      },
    });

    mocks.getRequestLocale.mockResolvedValue("zh-CN");
    const chineseMetadata = await generateArticleMetadata({
      params: Promise.resolve({ slug: "choose-clothing-video-length" }),
    });
    expect(chineseMetadata.alternates?.canonical)
      .toBe("/zh/guides/choose-clothing-video-length");
  });
});
