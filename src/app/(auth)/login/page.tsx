import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

import { LogoLockup } from "@/components/brand/logo";
import { sanitizeAuthRedirect } from "@/lib/auth/redirects";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { SUPPORT_EMAIL } from "@/lib/support-email";

import { LoginForm } from "./login-form";

const loginCopy = {
  en: {
    home: "AI Clothes Video home", eyebrow: "Secure workspace access", title: "Sign in to AI Clothes Video",
    value: "Turn three authorized clothing images into a promotional product video.",
    help: "Use Google or a one-time email code. New accounts can configure a free trial before generation.",
    nav: "Public product links", demo: "View product demo", pricing: "View pricing", trial: "Start free trial",
    disclosure: "AI Clothes Video is an independent product that uses third-party AI models through its own workflow. It is not affiliated with or endorsed by any model provider. User generation text is screened before processing.",
    privacy: "Privacy", terms: "Terms", use: "Acceptable Use",
    posterAlt: "Generated red dress product video preview", sample: "Real workflow example",
    sampleTitle: "Source images stay the product boundary.",
    sampleBody: "The workspace checks front, back, and detail evidence before recommending supported product shots.",
  },
  "zh-CN": {
    home: "AI Clothes Video 首页", eyebrow: "安全访问工作台", title: "登录 AI Clothes Video",
    value: "用三张已获授权的服装图片生成商品宣传视频。",
    help: "使用 Google 或邮箱一次性验证码登录。新账号可在生成前配置免费试用。",
    nav: "公开产品链接", demo: "查看产品演示", pricing: "查看价格", trial: "开始免费试用",
    disclosure: "AI Clothes Video 是通过自有工作流调用第三方 AI 模型的独立产品，与任何模型提供商不存在隶属或背书关系。用户生成文本会在处理前接受审核。",
    privacy: "隐私政策", terms: "服务条款", use: "可接受使用政策",
    posterAlt: "红色连衣裙商品视频生成预览", sample: "真实工作流样例",
    sampleTitle: "素材图片始终是产品边界。",
    sampleBody: "工作台先检查正面、背面和细节证据，再推荐有素材支持的商品镜头。",
  },
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const [resolvedSearchParams, locale] = await Promise.all([
    searchParams ?? Promise.resolve<{ next?: string }>({}),
    getRequestLocale(),
  ]);
  const callbackURL = localizeHref(
    sanitizeAuthRedirect(resolvedSearchParams.next),
    locale,
  );
  const copy = loginCopy[locale];

  return (
    <main className="min-h-screen bg-[var(--surface-raised)] text-[var(--ink)]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(30rem,0.68fr)]">
        <section aria-labelledby="login-heading" className="flex min-h-screen items-center bg-[var(--surface-raised)] px-6 py-10 sm:px-10 sm:py-14 lg:col-start-2 lg:row-start-1 lg:px-14">
          <div className="mx-auto w-full max-w-lg">
            <div>
              <Link aria-label={copy.home} className="inline-flex" href={localizeHref("/", locale)}><LogoLockup /></Link>
              <p className="mt-9 text-sm font-semibold text-[var(--brand)]">{copy.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-normal sm:text-4xl" id="login-heading">{copy.title}</h1>
              <p className="mt-4 text-base leading-7 text-[var(--ink)]">{copy.value}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy.help}</p>
            </div>

            <div className="mt-8"><LoginForm callbackURL={callbackURL} language={locale} /></div>

            <nav aria-label={copy.nav} className="mt-8 grid border-y border-[var(--line)] text-sm sm:grid-cols-3">
              <Link className="inline-flex min-h-12 items-center justify-between gap-2 border-b border-[var(--line)] py-3 font-medium hover:text-[var(--brand)] sm:border-b-0 sm:pr-4" href={localizeHref("/#source-proof", locale)}>{copy.demo}<Play aria-hidden="true" size={15} /></Link>
              <Link className="inline-flex min-h-12 items-center justify-between gap-2 border-b border-[var(--line)] py-3 font-medium hover:text-[var(--brand)] sm:border-b-0 sm:border-l sm:px-4" href={localizeHref("/pricing", locale)}>{copy.pricing}<ArrowRight aria-hidden="true" size={15} /></Link>
              <Link className="inline-flex min-h-12 items-center justify-between gap-2 py-3 font-medium hover:text-[var(--brand)] sm:border-l sm:pl-4" href={localizeHref("/workspace?mode=trial&preset=minimal_studio", locale)}>{copy.trial}<ArrowRight aria-hidden="true" size={15} /></Link>
            </nav>

            <p className="mt-6 text-xs leading-5 text-[var(--muted)]">{copy.disclosure}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
              <Link className="hover:text-[var(--ink)]" href={localizeHref("/privacy", locale)}>{copy.privacy}</Link>
              <Link className="hover:text-[var(--ink)]" href={localizeHref("/terms", locale)}>{copy.terms}</Link>
              <Link className="hover:text-[var(--ink)]" href={localizeHref("/acceptable-use", locale)}>{copy.use}</Link>
              <a className="hover:text-[var(--ink)]" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </div>
          </div>
        </section>

        <aside className="relative min-h-[26rem] overflow-hidden bg-black lg:col-start-1 lg:row-start-1 lg:min-h-screen">
          <Image alt={copy.posterAlt} className="object-cover object-center" fill priority sizes="(max-width: 1023px) 100vw, 58vw" src="/demo/red-dress-poster.webp" />
          <div className="absolute inset-x-0 bottom-0 bg-black/80 px-6 py-7 text-white sm:px-10 lg:px-12 lg:py-10"><p className="text-xs font-semibold text-[var(--brand-light)]">{copy.sample}</p><h2 className="mt-3 max-w-lg text-2xl font-semibold leading-tight sm:text-3xl">{copy.sampleTitle}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/75">{copy.sampleBody}</p></div>
        </aside>
      </div>
    </main>
  );
}
