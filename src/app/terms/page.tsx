import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">服务条款</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-[var(--muted)]">
          <p>本服务用于服装商品图生成宣传短视频。用户应上传自己有权使用的素材。</p>
          <p>系统不会承诺生成结果 100% 无异常。任务通过质量检查后才开放下载并正式扣除点数。</p>
          <p>
            无背面图、无细节图或素材不完整时，相关镜头会被禁用。用户不得尝试通过 prompt 绕过素材和合规限制。
          </p>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
