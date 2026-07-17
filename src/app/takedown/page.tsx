import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { TakedownForm } from "@/components/public/takedown-form";
import { getServerSession } from "@/lib/auth/server";

export default async function TakedownPage() {
  const session = await getServerSession();
  const legalContactEmail = process.env.LEGAL_CONTACT_EMAIL?.trim() || "";

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={session?.user ?? null} />
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <header className="mb-8 border-b border-[var(--line)] pb-6">
          <h1 className="text-3xl font-semibold tracking-normal">侵权删除申请</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            用于报告未经授权使用的肖像、版权、商标或隐私内容。提交后由管理员核验，申请不会自动删除内容。
          </p>
        </header>
        <TakedownForm legalContactEmail={legalContactEmail} />
      </div>
      <PublicFooter />
    </main>
  );
}
