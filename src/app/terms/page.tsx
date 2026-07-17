import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";

export default async function TermsPage() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">服务条款</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          使用 RunwayTools 前，请确认你拥有上传素材的使用权，并理解生成视频可能受素材质量、内容审核和模型服务影响。
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
              禁止上传或生成违法、侵权、色情化、仇恨、暴力、欺诈、政治宣传、冒充代言或其他误导性内容，以及你无权使用的人像、商标或版权素材。
              用户不得尝试通过 prompt 绕过素材规则、内容审核或试用限制。
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">肖像与未成年人授权</h2>
            <p className="mt-2">
              上传包含可识别人物的素材前，你必须已获得该人物的肖像权和商业宣传授权；人物未满 18 周岁时，还必须取得其监护人授权。
              每次服务端上传都需要主动确认当前授权声明，声明不得预选或由系统代为同意。
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
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">权利通知</h2>
            <p className="mt-2">
              权利人可通过侵权删除申请提交可定位的内容引用和权利说明。平台会保存案件编号并由管理员核验；提交投诉不会自动删除内容，恶意或信息不足的申请可被驳回。
            </p>
          </section>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
