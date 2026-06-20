import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";

export default async function PrivacyPage() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">隐私政策</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          这是 RunwayTools 的基础隐私说明，用于解释我们如何处理你上传的素材、生成结果和账号数据。
        </p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">上传图片</h2>
            <p className="mt-2">
              你上传的服装商品图、背面图、细节图、场景图和生成结果会用于创建视频任务、展示历史记录、下载交付和排障。
              请只上传你有权使用的素材。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">模型调用</h2>
            <p className="mt-2">
              生成链路会把必要的图片、素材分析结果、用户填写文本和最终视频 prompt 发送给模型服务，用于素材识别、分镜生成、视频生成和质量检查。
              我们不会把 API Key、内部风控信号或完整供应商调试信息展示给普通用户。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Cloudflare R2</h2>
            <p className="mt-2">
              上传图片、片段视频、最终视频、封面和质检抽帧默认保存在私有 Cloudflare R2 对象存储中。
              用户访问文件时使用短期 signed URL，bucket 不作为公开目录开放。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">保存周期</h2>
            <p className="mt-2">
              默认保存周期：上传原图和最终视频约 180 天，片段视频和普通质检抽帧约 30 天，异常或申诉相关文件可保留更久用于排障。
              账务、订单和必要审计记录会按合规与对账需要保留。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">删除</h2>
            <p className="mt-2">
              你可以请求删除任务素材或账号数据。删除通常先在数据库标记，再由后台清理任务异步移除 R2 文件；
              已产生的订单、点数流水和安全审计记录可能需要保留。
            </p>
          </section>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
