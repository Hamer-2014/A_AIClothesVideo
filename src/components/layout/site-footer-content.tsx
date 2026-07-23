import Link from "next/link";

import { SUPPORT_EMAIL } from "@/lib/support-email";

export function SiteFooterContent() {
  return (
    <>
      <p>2026 AI Clothes Video. All rights reserved.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p>Three clothing images. One product video.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <nav aria-label="Footer links" className="flex flex-wrap gap-4">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/acceptable-use">Acceptable Use</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/takedown">Takedown requests</Link>
        </nav>
      </div>
    </>
  );
}
