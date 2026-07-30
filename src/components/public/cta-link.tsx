"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { trackFunnelEvent } from "@/lib/analytics/client-funnel";
import { localizeHref, type SiteLocale } from "@/lib/i18n/config";

export function trialWorkspaceHref(locale: SiteLocale = "en") {
  return localizeHref(
    "/workspace?mode=trial&preset=minimal_studio",
    locale,
  );
}

export function loginTrialHref(locale: SiteLocale = "en") {
  return localizeHref(
    `/login?next=${encodeURIComponent(trialWorkspaceHref(locale))}`,
    locale,
  );
}

export function TrialCtaLink({
  children = "免费生成 1 条试用视频",
  sourcePage = "homepage",
  ctaPosition = "header",
  compact = false,
  ariaLabel,
  locale = "en",
}: {
  children?: React.ReactNode;
  sourcePage?: string;
  ctaPosition?: string;
  compact?: boolean;
  ariaLabel?: string;
  locale?: SiteLocale;
}) {
  return (
    <Link
      aria-label={ariaLabel}
      className={`group inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--action)] text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)] ${compact ? "gap-1 px-3" : "gap-2 px-5"}`}
      href={trialWorkspaceHref(locale)}
      onClick={() => {
        void trackFunnelEvent("trial_cta_clicked", {
          sourcePage,
          ctaPosition,
          userState: "anonymous",
          presetId: "minimal_studio",
          mode: "trial",
        });
      }}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className={`transition-transform group-hover:translate-x-0.5 ${compact ? "hidden sm:block" : ""}`}
        size={16}
      />
    </Link>
  );
}

export function WorkspaceCtaLink({
  children = "进入工作台",
  sourcePage = "homepage",
  ctaPosition = "header",
  compact = false,
  ariaLabel,
  locale = "en",
}: {
  children?: React.ReactNode;
  sourcePage?: string;
  ctaPosition?: string;
  compact?: boolean;
  ariaLabel?: string;
  locale?: SiteLocale;
}) {
  return (
    <Link
      aria-label={ariaLabel}
      className={compact
        ? "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap px-1 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        : "group inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--action)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)]"}
      href={localizeHref("/workspace", locale)}
      onClick={() => {
        void trackFunnelEvent("workspace_cta_clicked", {
          sourcePage,
          ctaPosition,
          userState: "authenticated",
        });
      }}
    >
      {children}
      {compact ? null : (
        <ArrowRight
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
          size={16}
        />
      )}
    </Link>
  );
}
