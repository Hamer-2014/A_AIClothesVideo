import Image from "next/image";
import { ArrowDown, ArrowRight, Check } from "lucide-react";

import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";
import { isVideoDurationEnabled } from "@/lib/video/specs";
import { recordFunnelEventSafely } from "@/server/analytics/funnel-events";

const sourceImages = [
  {
    alt: "红色礼服正面原始素材",
    label: "正面",
    note: "确认轮廓与主体",
    src: "/demo/red-dress-front.webp",
  },
  {
    alt: "红色礼服背面原始素材",
    label: "背面",
    note: "约束背面展示",
    src: "/demo/red-dress-back.webp",
  },
  {
    alt: "红色礼服细节原始素材",
    label: "细节",
    note: "提供纹理依据",
    src: "/demo/red-dress-detail.webp",
  },
] as const;

export default async function Home() {
  const session = await getServerSession();
  const user = session?.user ?? null;
  const duration40Enabled = isVideoDurationEnabled(40, process.env);
  await recordFunnelEventSafely({
    eventName: "landing_viewed",
    source: "server",
    userId: user?.id ?? null,
    path: "/",
    metadata: { sourcePage: "landing" },
  });

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader user={user} />

      <section className="landing-hero" aria-labelledby="landing-title">
        <video
          autoPlay
          className="landing-hero-video"
          data-testid="landing-hero-video"
          loop
          muted
          playsInline
          poster="/demo/red-dress-poster.webp"
          preload="metadata"
          src="/demo/red-dress-video.mp4"
        />
        <div aria-hidden="true" className="landing-hero-shade" />
        <div className="relative z-10 mx-auto flex min-h-[inherit] w-full max-w-7xl items-end px-5 pb-16 pt-20 sm:px-8 lg:items-center lg:px-12 lg:py-16">
          <div className="landing-hero-copy max-w-2xl text-white">
            <p className="text-sm font-semibold uppercase text-white/72">
              Three images. One product video.
            </p>
            <h1
              className="mt-4 text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl"
              id="landing-title"
            >
              AI Clothes Video
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/86 sm:text-lg sm:leading-8">
              上传 3 张服装图，系统按正面、背面与细节的真实素材边界，生成可发布的商品宣传视频。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <a
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--action)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)]"
                  href="/workspace"
                >
                  进入工作台
                  <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" size={16} />
                </a>
              ) : (
                <TrialCtaLink sourcePage="landing" />
              )}
              <a
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-white/45 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
                href="/pricing"
              >
                查看价格
              </a>
            </div>
            <p className="mt-6 flex max-w-lg items-start gap-2 text-sm leading-6 text-white/72">
              <Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-light)]" size={17} />
              无背面图不生成背面，无细节图不生成细节特写。
            </p>
          </div>
        </div>
        <a
          aria-label="查看三图输入示例"
          className="absolute bottom-5 right-5 z-10 inline-flex size-11 items-center justify-center border border-white/35 text-white transition-colors hover:bg-white/10 sm:right-8"
          href="#source-proof"
        >
          <ArrowDown aria-hidden="true" size={18} />
        </a>
      </section>

      <section className="bg-[var(--surface-raised)]" id="source-proof">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12 lg:py-28">
          <div className="max-w-md self-end">
            <p className="text-sm font-semibold text-[var(--brand)]">01 / 输入证据</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              正面、背面、细节，不是随便凑三张。
            </h2>
            <p className="mt-5 text-base leading-7 text-[var(--muted)]">
              每个槽位都有明确用途。素材缺失时，工作台会收紧可用镜头，避免凭空补造服装结构。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden bg-[var(--line-strong)]">
            {sourceImages.map((image, index) => (
              <figure className="group min-w-0 bg-[var(--surface-raised)]" key={image.src}>
                <div className="relative aspect-[2/3] overflow-hidden bg-[var(--surface-subtle)]">
                  <Image
                    alt={image.alt}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    fill
                    sizes="(max-width: 1023px) 33vw, 22vw"
                    src={image.src}
                    unoptimized
                  />
                </div>
                <figcaption className="border-t border-[var(--line)] px-3 py-4 sm:px-5">
                  <p className="text-xs text-[var(--muted)]">0{index + 1}</p>
                  <p className="mt-1 text-sm font-semibold">{image.label}</p>
                  <p className="mt-1 hidden text-xs text-[var(--muted)] sm:block">
                    {image.note}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[var(--brand-light)]">02 / 生成流程</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              从素材到成片，只做三次决定。
            </h2>
          </div>
          <ol className="mt-14 grid border-y border-white/20 md:grid-cols-3 md:divide-x md:divide-white/20">
            {[
              ["01", "选择三图协议", "商品展示、商品旋转或真人转身，先确定素材该如何被理解。"],
              ["02", "确认安全镜头", "系统根据素材完整度与风格预设推荐可用镜头。"],
              ["03", "生成并下载", `输出 ${duration40Enabled ? "8/16/24 秒或 40 秒 Beta" : "8/16/24 秒"}完整视频，任务进度与质检结果可追踪。`],
            ].map(([number, title, body]) => (
              <li className="py-8 md:px-8 md:first:pl-0 md:last:pr-0" key={number}>
                <p className="text-xs text-white/48">{number}</p>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[var(--background)]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-28">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden bg-black">
            <Image
              alt="红色礼服生成视频样片画面"
              className="object-cover"
              fill
              sizes="(max-width: 1023px) 90vw, 38vw"
              src="/demo/red-dress-poster.webp"
              unoptimized
            />
          </div>
          <div className="max-w-xl lg:pl-8">
            <p className="text-sm font-semibold text-[var(--brand)]">03 / 输出成片</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              一条能直接进入商品页和社媒测试的宣传视频。
            </h2>
            <p className="mt-5 text-base leading-7 text-[var(--muted)]">
              演示样片来自本项目真实端到端测试资产。它用于证明三图输入到视频输出的产品路径，不代表所有服装都会得到完全相同的动作与画面。
            </p>
            <dl className="mt-9 divide-y divide-[var(--line-strong)] border-y border-[var(--line-strong)]">
              <div className="flex items-center justify-between gap-5 py-4 text-sm">
                <dt className="text-[var(--muted)]">公开时长</dt>
                <dd className="font-semibold">8 / 16 / 24 秒</dd>
              </div>
              <div className="flex items-center justify-between gap-5 py-4 text-sm">
                <dt className="text-[var(--muted)]">内容边界</dt>
                <dd className="font-semibold">按上传素材约束镜头</dd>
              </div>
              <div className="flex items-center justify-between gap-5 py-4 text-sm">
                <dt className="text-[var(--muted)]">交付状态</dt>
                <dd className="font-semibold">可预览、可下载、可追踪</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div>
            <p className="text-sm font-semibold text-white/70">从一个 SKU 开始</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              把现有商品图变成第一条宣传视频。
            </h2>
          </div>
          {user ? (
            <a
              className="group inline-flex h-11 shrink-0 items-center gap-2 bg-white px-5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--brand-soft)]"
              href="/workspace"
            >
              制作第一条视频
              <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" size={16} />
            </a>
          ) : (
            <TrialCtaLink sourcePage="landing-footer">
              制作第一条视频
            </TrialCtaLink>
          )}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
