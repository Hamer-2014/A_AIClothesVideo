import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { TakedownForm } from "@/components/public/takedown-form";
import { getServerSession } from "@/lib/auth/server";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function TakedownPage() {
  const [session, locale] = await Promise.all([getServerSession(), getRequestLocale()]);
  const isChinese = locale === "zh-CN";
  const legalContactEmail = process.env.LEGAL_CONTACT_EMAIL?.trim() || "";

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader language={locale} sourcePage="takedown" user={session?.user ?? null} />
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <header className="mb-8 border-b border-[var(--line)] pb-6">
          <h1 className="text-3xl font-semibold tracking-normal">{isChinese ? "侵权删除申请" : "Takedown request"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {isChinese ? "举报未经授权使用肖像、版权、商标或隐私权的内容。管理员会审核每份申请；提交通知不会自动删除内容。" : "Report unauthorized use of likeness, copyright, trademark, or privacy rights. An administrator reviews each request; submitting a notice does not automatically remove content."}
          </p>
        </header>
        <TakedownForm language={locale} legalContactEmail={legalContactEmail} />
      </div>
      <PublicFooter language={locale} />
    </main>
  );
}
