import { SiteFooterContent } from "@/components/layout/site-footer-content";

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm text-[var(--muted)] sm:px-8 lg:px-12">
        <SiteFooterContent />
      </div>
    </footer>
  );
}
