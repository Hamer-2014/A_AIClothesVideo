import { SiteFooterContent } from "./site-footer-content";

export function AppFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white text-sm text-[var(--muted)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <SiteFooterContent />
      </div>
    </footer>
  );
}
