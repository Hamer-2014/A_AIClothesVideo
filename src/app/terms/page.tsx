import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">服务条款</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          这是公开 MVP 试用阶段的基础服务条款说明，不是最终法律意见。正式商用前应由法律顾问复核。
        </p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">用户上传素材</h2>
            <p className="mt-2">
              本服务用于服装商品图生成宣传短视频。你应上传自己拥有权利或已获授权使用的商品图片、品牌元素和文案。
              你保留素材权利，同时授权我们为提供生成、质检、下载、排障和合规审核而处理这些素材。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">禁止内容</h2>
            <p className="mt-2">
              禁止上传或生成违法、侵权、色情、仇恨、暴力、欺诈、误导性医疗或金融承诺，以及你无权使用的人像、商标或版权素材。
              用户不得尝试通过 prompt 绕过素材规则、内容审核或试用限制。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">试用限制</h2>
            <p className="mt-2">
              免费试用限新用户 1 条 8 秒视频，低分辨率、无音频、带水印，只开放低风险镜头。
              无背面图不生成背面，无细节图不生成细节特写。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">生成失败</h2>
            <p className="mt-2">
              视频生成依赖素材质量、模型服务、内容审核和质量检查。我们会尽力排障，但不承诺每次生成都无异常或完全还原。
              供应商失败、审核阻断、素材不合格或质检失败时，任务可能无法交付。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">退款</h2>
            <p className="mt-2">
              点数通常在确认生成后冻结，最终视频通过质量检查并可交付后正式扣除。
              如果任务失败、未生成或无法交付，系统会按状态释放冻结点数或退回点数；已交付内容不代表没有任何商业使用风险。
            </p>
          </section>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
