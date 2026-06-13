import Link from "next/link";
import { type ReactNode } from "react";
import { Wallet } from "lucide-react";

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

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="border-b border-[var(--line)] pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                RunwayTools
              </p>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  {subtitle}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              {user ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="max-w-48 truncate font-medium">{displayName}</p>
                    {user.email ? (
                      <p className="max-w-48 truncate text-xs text-[var(--muted)]">
                        {user.email}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-medium hover:border-[var(--accent)]"
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
          <nav className="mt-5 flex flex-wrap gap-2">
            {nav.map((item) => (
              <Link
                className={`inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition ${
                  item.active
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent)]"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="flex-1 py-6">{children}</div>
      </div>
    </main>
  );
}
