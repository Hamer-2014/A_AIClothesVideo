import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
            Clothing product video generator
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
            把服装商品图变成可发布的短视频
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
            上传正面图，选择风格预设，系统自动推荐安全镜头，生成 8/16/24 秒商品宣传视频。
            免费试用默认 8 秒、低分辨率、无音频、带水印。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <TrialCtaLink />
            <a
              className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-medium"
              href="/pricing"
            >
              查看价格
            </a>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">试用流程</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <li>1. 登录后进入极简棚拍试用模式。</li>
            <li>2. 上传服装正面图，可补背面、细节或场景图。</li>
            <li>3. 系统分析素材并自动选择安全镜头。</li>
            <li>4. 生成完成后下载带水印试用视频。</li>
          </ol>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-14 md:grid-cols-3">
        {[
          ["不编造服装细节", "无背面图不生成背面，无细节图不生成细节特写。"],
          ["Preset 简化选择", "用户选风格，系统自动推荐镜头模板。"],
          ["点数清晰", "确认分镜后冻结点数，质检通过后正式扣除。"],
        ].map(([title, text]) => (
          <div className="rounded-lg border border-[var(--line)] bg-white p-5" key={title}>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
          </div>
        ))}
      </section>
      <PublicFooter />
    </main>
  );
}
