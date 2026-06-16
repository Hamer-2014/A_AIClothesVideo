import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">隐私政策</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-[var(--muted)]">
          <p>
            我们会保存账号信息、上传素材、生成任务、点数流水和模型调用审计记录，用于提供生成、下载、排障和合规审核。
          </p>
          <p>用户上传图片和生成视频默认存储在私有对象存储中，访问使用短期 signed URL。</p>
          <p>
            用于生成链路的用户文本和最终 prompt 会经过 Creem Moderation。审核失败或服务不可用时，生成会被阻止。
          </p>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
