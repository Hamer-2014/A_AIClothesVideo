import Link from "next/link";
import { type ReactNode } from "react";

interface DashboardShellProps {
  title: string;
  subtitle: string;
  nav: Array<{
    href: string;
    label: string;
    active?: boolean;
  }>;
  actions?: ReactNode;
  children: ReactNode;
}

export function DashboardShell({
  title,
  subtitle,
  nav,
  actions,
  children,
}: DashboardShellProps) {
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
            {actions ? <div className="shrink-0">{actions}</div> : null}
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
