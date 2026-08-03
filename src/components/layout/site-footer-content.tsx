import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";
import { localizeHref, type SiteLocale } from "@/lib/i18n/config";
import { SUPPORT_EMAIL } from "@/lib/support-email";

export function SiteFooterContent({ language = "en" }: { language?: SiteLocale }) {
  const isChinese = language === "zh-CN";
  const linkClassName = "text-sm text-[var(--muted)] hover:text-[var(--ink)]";

  return (
    <div className="w-full">
      <div className="grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,1fr))] lg:gap-12">
        <div className="max-w-md">
          <LogoLockup markSize={36} />
          <p className="mt-5 text-base font-medium text-[var(--ink)]">
            {isChinese ? "三张同款服装图，一条商品视频。" : "Three clothing images. One product video."}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {isChinese
              ? "按协议上传三张同款有效素材，生成更可控的服装商品视频。"
              : "Upload three valid images of the same garment for a more controllable product video."}
          </p>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            {isChinese
              ? "素材没有的背面与细节，不会作为可用镜头生成。"
              : "Back and detail shots are only available when the source material supports them."}
          </p>
        </div>

        <nav aria-label={isChinese ? "产品" : "Product"}>
          <p className="text-sm font-semibold text-[var(--ink)]">{isChinese ? "产品" : "Product"}</p>
          <div className="mt-4 flex flex-col items-start gap-3">
            <Link className={linkClassName} href={localizeHref("/", language)}>{isChinese ? "首页" : "Home"}</Link>
            <Link className={linkClassName} href={localizeHref("/three-images-to-clothing-video", language)}>{isChinese ? "三图生成视频" : "Three-image video"}</Link>
            <Link className={linkClassName} href={localizeHref("/guides", language)}>{isChinese ? "实用指南" : "Guides"}</Link>
            <Link className={linkClassName} href={localizeHref("/virtual-try-on", language)}>{isChinese ? "虚拟试穿" : "Virtual try-on"}</Link>
            <Link className={linkClassName} href={localizeHref("/examples", language)}>{isChinese ? "素材案例" : "Source examples"}</Link>
          </div>
        </nav>

        <nav aria-label={isChinese ? "使用" : "Use"}>
          <p className="text-sm font-semibold text-[var(--ink)]">{isChinese ? "使用" : "Use"}</p>
          <div className="mt-4 flex flex-col items-start gap-3">
            <Link className={linkClassName} href={localizeHref("/pricing", language)}>{isChinese ? "价格" : "Pricing"}</Link>
            {isChinese ? <Link className={linkClassName} href={localizeHref("/faq", language)}>常见问题</Link> : null}
            <Link className={linkClassName} href={localizeHref("/workspace", language)}>{isChinese ? "进入工作台" : "Workspace"}</Link>
          </div>
        </nav>

        <nav aria-label={isChinese ? "信任与支持" : "Trust and support"}>
          <p className="text-sm font-semibold text-[var(--ink)]">{isChinese ? "信任与支持" : "Trust and support"}</p>
          <div className="mt-4 flex flex-col items-start gap-3">
            <Link className={linkClassName} href={localizeHref("/privacy", language)}>{isChinese ? "隐私政策" : "Privacy"}</Link>
            <Link className={linkClassName} href={localizeHref("/terms", language)}>{isChinese ? "服务条款" : "Terms"}</Link>
            <Link className={linkClassName} href={localizeHref("/acceptable-use", language)}>{isChinese ? "可接受使用政策" : "Acceptable Use"}</Link>
            <Link className={linkClassName} href={localizeHref("/takedown", language)}>{isChinese ? "侵权删除" : "Takedown requests"}</Link>
            <a className={linkClassName} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </div>
        </nav>
      </div>
      <p className="border-t border-[var(--line)] py-6 text-xs text-[var(--muted)]">
        {isChinese ? "2026 AI Clothes Video。保留所有权利。" : "2026 AI Clothes Video. All rights reserved."}
      </p>
    </div>
  );
}
