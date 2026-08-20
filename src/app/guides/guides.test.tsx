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

  it("publishes an English-first guide index with twelve discoverable articles", async () => {
    render(await GuidesIndexPage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Make better clothing videos before you press generate",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Can you make a clothing video without a back image?" }))
      .toHaveAttribute("href", "/guides/clothing-video-without-back-image");
    expect(screen.getByRole("link", { name: "Should a clothing product video be 8, 16, 24, or 32 seconds?" }))
      .toHaveAttribute("href", "/guides/choose-clothing-video-length");
    expect(screen.getByRole("link", { name: "Why do AI clothing videos deform or drift?" }))
      .toHaveAttribute("href", "/guides/why-ai-clothing-videos-deform");
    expect(screen.getByRole("link", { name: "How do you check whether clothing images show the same SKU?" }))
      .toHaveAttribute("href", "/guides/check-clothing-images-match");
    expect(screen.getByRole("link", { name: "Model, mannequin, or flat lay: which clothing photos work for AI video?" }))
      .toHaveAttribute("href", "/guides/model-mannequin-flat-lay-for-ai-video");
    expect(screen.getByRole("link", { name: "How to plan a clothing product video shot list" }))
      .toHaveAttribute("href", "/guides/plan-clothing-video-shots");
    expect(screen.getByRole("link", { name: "How to photograph clothing details for AI video" }))
      .toHaveAttribute("href", "/guides/how-to-photograph-clothing-details");
    expect(screen.getByRole("link", { name: "9:16, 1:1, or 16:9: which clothing video aspect ratio should you choose?" }))
      .toHaveAttribute("href", "/guides/choose-clothing-video-aspect-ratio");
    expect(screen.getByRole("link", { name: "How to review an AI clothing video before publishing" }))
      .toHaveAttribute("href", "/guides/review-clothing-video-before-publishing");
    expect(screen.getByRole("link", { name: "White background or lifestyle scene: which works for a clothing video?" }))
      .toHaveAttribute("href", "/guides/choose-background-for-clothing-video");
    expect(screen.getByRole("link", { name: "How to choose a cover image for a clothing product video" }))
      .toHaveAttribute("href", "/guides/choose-clothing-video-cover-image");
    expect(screen.getByRole("link", { name: "When should you reshoot clothing photos before making an AI video?" }))
      .toHaveAttribute("href", "/guides/when-to-reshoot-clothing-photos");
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
    expect(screen.getByRole("link", { name: "如何检查服装图片是不是同一件 SKU？" }))
      .toHaveAttribute("href", "/zh/guides/check-clothing-images-match");
    expect(screen.getByRole("link", { name: "真人模特、人台还是平铺图：哪种素材适合 AI 服装视频？" }))
      .toHaveAttribute("href", "/zh/guides/model-mannequin-flat-lay-for-ai-video");
    expect(screen.getByRole("link", { name: "如何拍摄适合 AI 视频的服装细节图？" }))
      .toHaveAttribute("href", "/zh/guides/how-to-photograph-clothing-details");
    expect(screen.getByRole("link", { name: "服装视频选 9:16、1:1 还是 16:9？" }))
      .toHaveAttribute("href", "/zh/guides/choose-clothing-video-aspect-ratio");
    expect(screen.getByRole("link", { name: "服装视频用白底还是场景背景？" }))
      .toHaveAttribute("href", "/zh/guides/choose-background-for-clothing-video");
    expect(screen.getByRole("link", { name: "服装商品视频封面图怎么选？" }))
      .toHaveAttribute("href", "/zh/guides/choose-clothing-video-cover-image");
    expect(screen.getByRole("link", { name: "制作 AI 视频前，什么情况下应该重拍服装图？" }))
      .toHaveAttribute("href", "/zh/guides/when-to-reshoot-clothing-photos");
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

  it("explains the four-shot 32-second option in both length-guide locales", async () => {
    render(await GuideArticlePage({
      params: Promise.resolve({ slug: "choose-clothing-video-length" }),
    }));

    expect(screen.getByRole("heading", {
      level: 1,
      name: "Should a clothing product video be 8, 16, 24, or 32 seconds?",
    })).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "32 seconds: use four shots only when each adds evidence",
    })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "32 seconds" })).toBeInTheDocument();

    cleanup();
    mocks.getRequestLocale.mockResolvedValue("zh-CN");
    render(await GuideArticlePage({
      params: Promise.resolve({ slug: "choose-clothing-video-length" }),
    }));

    expect(screen.getByRole("heading", {
      level: 1,
      name: "服装商品视频做 8 秒、16 秒、24 秒还是 32 秒？",
    })).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "32 秒：四个镜头都必须增加有效信息",
    })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "32 秒" })).toBeInTheDocument();
  });

  it("publishes static params and symmetric English/Chinese metadata", async () => {
    expect(generateStaticParams()).toEqual([
      { slug: "clothing-video-without-back-image" },
      { slug: "choose-clothing-video-length" },
      { slug: "why-ai-clothing-videos-deform" },
      { slug: "check-clothing-images-match" },
      { slug: "model-mannequin-flat-lay-for-ai-video" },
      { slug: "plan-clothing-video-shots" },
      { slug: "how-to-photograph-clothing-details" },
      { slug: "choose-clothing-video-aspect-ratio" },
      { slug: "review-clothing-video-before-publishing" },
      { slug: "choose-background-for-clothing-video" },
      { slug: "choose-clothing-video-cover-image" },
      { slug: "when-to-reshoot-clothing-photos" },
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
