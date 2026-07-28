import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

import { TrialCtaLink, WorkspaceCtaLink } from "./cta-link";

interface PublicHeaderProps {
  language?: "en" | "zh-CN";
  sourcePage?: string;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function PublicHeader({
  language = "en",
  sourcePage = "homepage",
  user,
}: PublicHeaderProps) {
  const isChinese = language === "zh-CN";
  const displayName = user?.name || user?.email || (isChinese ? "当前用户" : "Current user");

  return (
    <header className="relative z-20 border-b border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-8 lg:px-12">
        <Link href="/" aria-label={isChinese ? "AI Clothes Video 首页" : "AI Clothes Video home"}>
          <LogoLockup />
        </Link>
        <nav aria-label={isChinese ? "主导航" : "Primary navigation"} className="flex items-center gap-2 text-sm sm:gap-4">
          {isChinese ? (
            <div className="hidden items-center gap-5 lg:flex">
              <Link className="text-[var(--muted)] hover:text-[var(--ink)]" href="/three-images-to-clothing-video">
                三图生成
              </Link>
              <Link className="text-[var(--muted)] hover:text-[var(--ink)]" href="/pricing">
                价格
              </Link>
              <Link className="text-[var(--muted)] hover:text-[var(--ink)]" href="/faq">
                常见问题
              </Link>
            </div>
          ) : (
            <Link className="hidden text-[var(--muted)] hover:text-[var(--ink)] sm:inline-flex" href="/pricing">
              Pricing
            </Link>
          )}
          {user ? (
            <>
              <WorkspaceCtaLink
                ariaLabel={isChinese ? "进入工作台" : "Workspace"}
                compact
                ctaPosition="header"
                sourcePage={sourcePage}
              >
                {isChinese ? (
                  <>
                    <span className="hidden min-[360px]:inline">进入工作台</span>
                    <span className="min-[360px]:hidden">工作台</span>
                  </>
                ) : (
                  "Workspace"
                )}
              </WorkspaceCtaLink>
              <span className="hidden max-w-40 truncate text-[var(--muted)] lg:inline">
                {displayName}
              </span>
              <SignOutButton compact label={isChinese ? "退出登录" : "Sign out"} />
            </>
          ) : (
            <>
              <Link
                className="whitespace-nowrap text-[var(--muted)] hover:text-[var(--ink)]"
                href="/login"
              >
                {isChinese ? "登录" : "Sign in"}
              </Link>
              <TrialCtaLink
                ariaLabel={isChinese ? "免费试用" : undefined}
                compact
                ctaPosition="header"
                sourcePage={sourcePage}
              >
                {isChinese ? (
                  <>
                    <span className="hidden min-[360px]:inline">免费试用</span>
                    <span className="min-[360px]:hidden">试用</span>
                  </>
                ) : (
                  "Free trial"
                )}
              </TrialCtaLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
