import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";

import { TrialCtaLink } from "./cta-link";

export function PublicHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" aria-label="RunwayTools 首页">
          <LogoLockup />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="text-[var(--muted)] hover:text-[var(--ink)]" href="/pricing">
            价格
          </Link>
          <Link className="text-[var(--muted)] hover:text-[var(--ink)]" href="/faq">
            FAQ
          </Link>
          <Link className="text-[var(--muted)] hover:text-[var(--ink)]" href="/login">
            登录
          </Link>
          <TrialCtaLink>免费试用</TrialCtaLink>
        </nav>
      </div>
    </header>
  );
}
