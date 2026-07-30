import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { localizeHref, type SiteLocale } from "@/lib/i18n/config";

import { TrialCtaLink, WorkspaceCtaLink } from "./cta-link";
import { MobileNavigation } from "./mobile-navigation";
import { publicNavigationItems } from "./public-navigation";

interface PublicHeaderProps {
  language?: SiteLocale;
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
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-8 lg:px-12">
        <Link href={localizeHref("/", language)} aria-label={isChinese ? "AI Clothes Video 首页" : "AI Clothes Video home"}>
          <LogoLockup labelClassName="hidden min-[480px]:inline" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <nav
            aria-label={isChinese ? "主导航" : "Primary navigation"}
            className="hidden items-center gap-6 text-sm lg:flex"
          >
          {publicNavigationItems[language].map((item) => (
            <Link
              className="text-[var(--muted)] hover:text-[var(--ink)]"
              href={localizeHref(item.href, language)}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          </nav>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <WorkspaceCtaLink
                ariaLabel={isChinese ? "进入工作台" : "Workspace"}
                compact
                ctaPosition="header"
                locale={language}
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
              <span className="hidden max-w-40 truncate text-sm text-[var(--muted)] xl:inline">
                {displayName}
              </span>
              <SignOutButton compact label={isChinese ? "退出登录" : "Sign out"} />
            </>
          ) : (
            <>
              <Link
                className="whitespace-nowrap text-[var(--muted)] hover:text-[var(--ink)]"
                href={localizeHref("/login", language)}
              >
                {isChinese ? "登录" : "Sign in"}
              </Link>
              <TrialCtaLink
                ariaLabel={isChinese ? "免费试用" : undefined}
                compact
                ctaPosition="header"
                locale={language}
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
            <LanguageSwitcher locale={language} />
            <MobileNavigation language={language} />
          </div>
        </div>
      </div>
    </header>
  );
}
