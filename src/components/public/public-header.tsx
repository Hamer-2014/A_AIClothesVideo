import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

import { TrialCtaLink } from "./cta-link";

interface PublicHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function PublicHeader({ user }: PublicHeaderProps) {
  const displayName = user?.name || user?.email || "Current user";

  return (
    <header className="relative z-20 border-b border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <Link href="/" aria-label="AI Clothes Video home">
          <LogoLockup />
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-3 text-sm sm:gap-4">
          <Link className="hidden text-[var(--muted)] hover:text-[var(--ink)] sm:inline-flex" href="/pricing">
            Pricing
          </Link>
          <Link className="hidden text-[var(--muted)] hover:text-[var(--ink)] md:inline-flex" href="/faq">
            FAQ
          </Link>
          {user ? (
            <>
              <Link
                className="text-[var(--muted)] hover:text-[var(--ink)]"
                href="/workspace"
              >
                Workspace
              </Link>
              <span className="hidden max-w-40 truncate text-[var(--muted)] lg:inline">
                {displayName}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                className="text-[var(--muted)] hover:text-[var(--ink)]"
                href="/login"
              >
                Sign in
              </Link>
              <TrialCtaLink>Free trial</TrialCtaLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
