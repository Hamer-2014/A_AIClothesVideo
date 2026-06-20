import { SiteFooterContent } from "@/components/layout/site-footer-content";

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-[var(--muted)]">
        <SiteFooterContent />
      </div>
    </footer>
  );
}
