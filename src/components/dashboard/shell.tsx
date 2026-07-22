import Link from "next/link";
import { type ReactNode } from "react";
import { Wallet } from "lucide-react";

import { LogoLockup } from "@/components/brand/logo";
import { AppFooter } from "@/components/layout/app-footer";

import { SignOutButton } from "./sign-out-button";

interface DashboardShellProps {
  title: string;
  subtitle: string;
  nav: Array<{
    href: string;
    label: string;
    active?: boolean;
  }>;
  actions?: ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
  billing?: {
    availableBalance: number;
    reservedBalance: number;
  } | null;
  children: ReactNode;
}

export function DashboardShell({
  title,
  subtitle,
  nav,
  actions,
  user,
  billing,
  children,
}: DashboardShellProps) {
  const displayName = user?.name || user?.email || "当前用户";
  const shouldShowEmail = Boolean(user?.email && user.name);

  return (
    <div
      className="min-h-svh bg-[var(--surface)] text-[var(--ink)]"
      data-testid="dashboard-public-shell"
    >
      <header
        className="border-b border-[var(--line)] bg-white"
        data-testid="dashboard-header"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/workspace" aria-label="AI Clothes Video 工作台">
              <LogoLockup />
            </Link>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              {user ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="max-w-48 truncate font-medium">{displayName}</p>
                    {shouldShowEmail ? (
                      <p className="max-w-48 truncate text-xs text-[var(--muted)]">
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-medium hover:border-[var(--accent)]"
                    href="/billing"
                  >
                    <Wallet aria-hidden="true" size={15} />
                    {billing ? (
                      <span>
                        {billing.availableBalance} 可用 / {billing.reservedBalance} 冻结
                      </span>
                    ) : (
                      <span>点数</span>
                    )}
                  </Link>
                  <SignOutButton />
                </div>
              ) : null}
              {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => (
              <Link
                className={`inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition ${
                  item.active
                    ? "border-[var(--action)] bg-[var(--brand-soft)] text-[var(--action-hover)]"
                    : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--action)] hover:bg-[var(--brand-soft)] hover:text-[var(--action-hover)]"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>
        <section
          className="border-b border-[var(--line)] bg-white"
          data-testid="dashboard-page-intro"
        >
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {subtitle}
            </p>
          </div>
        </section>
        <section
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          data-testid="dashboard-content"
        >
          {children}
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
