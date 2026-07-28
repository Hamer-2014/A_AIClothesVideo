import { SiteFooterContent } from "./site-footer-content";

export function AppFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white text-sm text-[var(--muted)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SiteFooterContent language="zh-CN" />
      </div>
    </footer>
  );
}
