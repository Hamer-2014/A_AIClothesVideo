import { SiteFooterContent } from "@/components/layout/site-footer-content";

export function PublicFooter({ language = "en" }: { language?: "en" | "zh-CN" }) {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface-raised)]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <SiteFooterContent language={language} />
      </div>
    </footer>
  );
}
