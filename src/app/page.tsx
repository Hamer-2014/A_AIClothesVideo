import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { SampleGallery } from "@/components/public/sample-gallery";
import { getServerSession } from "@/lib/auth/server";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

export default async function Home() {
  const session = await getServerSession();
  const user = session?.user ?? null;
  await recordFunnelEventSafely({
    eventName: "landing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: "/",
    metadata: { sourcePage: "landing" },
  });

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={user} />
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1fr_400px] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
            给跨境与独立站服装卖家
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
            把服装商品图变成可发布的短视频
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
            上传服装商品图，选择极简棚拍等 Style Preset，系统按素材完整度推荐安全镜头，
            生成 8/16/24 秒商品短视频。新用户可以免费试用 1 条。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {user ? (
              <a
                className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
                href="/workspace"
              >
                进入工作台
              </a>
            ) : (
              <TrialCtaLink sourcePage="landing" />
            )}
            <a
              className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-medium"
              href="/pricing"
            >
              查看价格
            </a>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-medium">免费试用包含什么</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium">输入</dt>
              <dd className="mt-1 text-[var(--muted)]">上传服装正面图，可补背面、细节、侧面或场景素材。</dd>
            </div>
            <div>
              <dt className="font-medium">输出</dt>
              <dd className="mt-1 text-[var(--muted)]">生成 1 条 8 秒商品短视频，适合先验证单个 SKU。</dd>
            </div>
            <div>
              <dt className="font-medium">限制</dt>
              <dd className="mt-1 text-[var(--muted)]">免费试用：8 秒、低分辨率、无音频、带水印。</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["极简棚拍", "适合 Shopify/独立站商品页，强调版型、轮廓和干净背景。"],
            ["电商主图动效", "适合白底图、平铺图，把主图做成轻量动态素材。"],
            ["社媒氛围短片", "适合 Reels/TikTok 测款；没有场景图时只做弱氛围表达。"],
          ].map(([title, text]) => (
            <div className="rounded-lg border border-[var(--line)] bg-white p-5" key={title}>
              <h2 className="text-sm font-medium">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">素材规则先说清楚</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
              <li>无背面图不生成背面。</li>
              <li>无细节图不生成细节特写。</li>
              <li>免费试用：8 秒、低分辨率、无音频、带水印。</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h3 className="text-sm font-medium">生成流程</h3>
            <ol className="mt-4 grid gap-3 text-sm leading-6 text-[var(--muted)] md:grid-cols-2">
              <li>1. 登录后进入极简棚拍试用模式。</li>
              <li>2. 上传服装商品图。</li>
              <li>3. 系统分析素材并推荐安全镜头。</li>
              <li>4. 生成完成后下载带水印试用视频。</li>
            </ol>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">真实样例</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              只展示真实生成过且允许公开的服装样例。
            </p>
          </div>
        </div>
        <SampleGallery samples={[]} />
      </section>
      <PublicFooter />
    </main>
  );
}
