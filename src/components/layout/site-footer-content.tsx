import Link from "next/link";

export function SiteFooterContent() {
  return (
    <>
      <p>2026 AI Clothes Video. All rights reserved.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p>Three clothing images. One product video.</p>
        <a href="mailto:support@aiclothesvideo.com">support@aiclothesvideo.com</a>
        <nav aria-label="页脚链接" className="flex flex-wrap gap-4">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/acceptable-use">Acceptable Use</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/takedown">侵权删除</Link>
        </nav>
      </div>
    </>
  );
}
