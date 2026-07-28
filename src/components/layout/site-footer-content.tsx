import Link from "next/link";

import { SUPPORT_EMAIL } from "@/lib/support-email";

export function SiteFooterContent({ language = "en" }: { language?: "en" | "zh-CN" }) {
  const isChinese = language === "zh-CN";

  return (
    <>
      <p>{isChinese ? "2026 AI Clothes Video。保留所有权利。" : "2026 AI Clothes Video. All rights reserved."}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p>{isChinese ? "三张同款服装图，一条商品视频。" : "Three clothing images. One product video."}</p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <nav aria-label={isChinese ? "页脚链接" : "Footer links"} className="flex flex-wrap gap-4">
          <Link href="/privacy">{isChinese ? "隐私政策" : "Privacy"}</Link>
          <Link href="/terms">{isChinese ? "服务条款" : "Terms"}</Link>
          <Link href="/acceptable-use">{isChinese ? "可接受使用政策" : "Acceptable Use"}</Link>
          <Link href="/pricing">{isChinese ? "价格" : "Pricing"}</Link>
          {isChinese ? <Link href="/faq">常见问题</Link> : null}
          <Link href="/takedown">{isChinese ? "侵权删除" : "Takedown requests"}</Link>
        </nav>
      </div>
    </>
  );
}
