"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";

import { localizeHref, type SiteLocale } from "@/lib/i18n/config";

interface LanguageSwitcherProps {
  locale: SiteLocale;
  pathname?: string;
  search?: string;
}

export function LanguageSwitcher({
  locale,
  pathname: pathnameOverride,
  search: searchOverride,
}: LanguageSwitcherProps) {
  const currentPathname = usePathname();
  const currentSearchParams = useSearchParams();
  const pathname = pathnameOverride ?? currentPathname ?? "/";
  const search = searchOverride ?? currentSearchParams.toString();
  const targetLocale: SiteLocale = locale === "en" ? "zh-CN" : "en";
  const href = localizeHref(
    `${pathname}${search ? `?${search}` : ""}`,
    targetLocale,
  );
  const isEnglish = locale === "en";

  return (
    <a
      aria-label={isEnglish ? "Switch to Chinese" : "切换到英文"}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 border-l border-[var(--line)] px-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
      href={href}
    >
      <Languages aria-hidden="true" size={17} strokeWidth={1.8} />
      <span>{isEnglish ? "ZH" : "EN"}</span>
    </a>
  );
}
