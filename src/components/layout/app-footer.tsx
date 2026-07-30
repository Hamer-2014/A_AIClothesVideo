import { SiteFooterContent } from "./site-footer-content";
import type { SiteLocale } from "@/lib/i18n/config";

export function AppFooter({ language = "zh-CN" }: { language?: SiteLocale }) {
  return (
    <footer className="border-t border-[var(--line)] bg-white text-sm text-[var(--muted)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SiteFooterContent language={language} />
      </div>
    </footer>
  );
}
