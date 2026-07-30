import { SiteFooterContent } from "@/components/layout/site-footer-content";
import type { SiteLocale } from "@/lib/i18n/config";

export function PublicFooter({ language = "en" }: { language?: SiteLocale }) {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <SiteFooterContent language={language} />
      </div>
    </footer>
  );
}
