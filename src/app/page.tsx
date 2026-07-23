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
    alt: "Original front image of a red dress",
    label: "Front",
    note: "Confirms the garment shape and subject",
    src: "/demo/red-dress-front.webp",
  },
  {
    alt: "Original back image of a red dress",
    label: "Back",
    note: "Supports a back-view shot",
    src: "/demo/red-dress-back.webp",
  },
  {
    alt: "Original detail image of a red dress",
    label: "Detail",
    note: "Supports material-detail shots",
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
              Use exactly three clothing images to create an 8-, 16-, or 24-second product video, constrained by the real front, back, and detail material you provide.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <a
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--action)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)]"
                  href="/workspace"
                >
                  Go to workspace
                  <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" size={16} />
                </a>
              ) : (
                <TrialCtaLink sourcePage="landing">Create one free trial video</TrialCtaLink>
              )}
              <a
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-white/45 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
                href="/pricing"
              >
                View pricing
              </a>
            </div>
            <p className="mt-6 flex max-w-lg items-start gap-2 text-sm leading-6 text-white/72">
              <Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-light)]" size={17} />
              No back-view image means no back view. No detail image means no invented detail close-up.
            </p>
          </div>
        </div>
        <a
          aria-label="View the three-image input example"
          className="absolute bottom-5 right-5 z-10 inline-flex size-11 items-center justify-center border border-white/35 text-white transition-colors hover:bg-white/10 sm:right-8"
          href="#source-proof"
        >
          <ArrowDown aria-hidden="true" size={18} />
        </a>
      </section>

      <section className="bg-[var(--surface-raised)]" id="source-proof">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:px-12 lg:py-28">
          <div className="max-w-md self-end">
            <p className="text-sm font-semibold text-[var(--brand)]">01 / Source evidence</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              Front, back, and detail images each establish a real boundary.
            </h2>
            <p className="mt-5 text-base leading-7 text-[var(--muted)]">
              Each image has a defined purpose. When material is missing, the workspace narrows available shots instead of inventing garment structure.
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
            <p className="text-sm font-semibold text-[var(--brand-light)]">02 / Workflow</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              From source material to a product video in three decisions.
            </h2>
          </div>
          <ol className="mt-14 grid border-y border-white/20 md:grid-cols-3 md:divide-x md:divide-white/20">
            {[
              ["01", "Select a source set", "Choose how the uploaded images establish the product evidence."],
              ["02", "Confirm safe shots", "The system recommends available shots from material completeness and style preset rules."],
              ["03", "Generate and download", `Create a complete ${duration40Enabled ? "8-, 16-, 24-second, or 40-second Beta" : "8-, 16-, or 24-second"} video with trackable job and quality-check status.`],
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
              alt="Generated product-video frame for a red dress"
              className="object-cover"
              fill
              sizes="(max-width: 1023px) 90vw, 38vw"
              src="/demo/red-dress-poster.webp"
              unoptimized
            />
          </div>
          <div className="max-w-xl lg:pl-8">
            <p className="text-sm font-semibold text-[var(--brand)]">03 / Product video</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
              A promotional product video for product pages and social tests.
            </h2>
            <p className="mt-5 text-base leading-7 text-[var(--muted)]">
              The demo uses real end-to-end test assets from this product workflow. It shows the path from source images to a video, not a guarantee that every garment will receive identical motion or frames.
            </p>
            <dl className="mt-9 divide-y divide-[var(--line-strong)] border-y border-[var(--line-strong)]">
              <div className="flex items-center justify-between gap-5 py-4 text-sm">
                <dt className="text-[var(--muted)]">Public lengths</dt>
                <dd className="font-semibold">8 / 16 / 24 seconds</dd>
              </div>
              <div className="flex items-center justify-between gap-5 py-4 text-sm">
                <dt className="text-[var(--muted)]">Content boundary</dt>
                <dd className="font-semibold">Shots follow uploaded material</dd>
              </div>
              <div className="flex items-center justify-between gap-5 py-4 text-sm">
                <dt className="text-[var(--muted)]">Delivery status</dt>
                <dd className="font-semibold">Previewable, downloadable, traceable</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div>
            <p className="text-sm font-semibold text-white/70">Start with one SKU</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              Turn existing product images into your first promotional video.
            </h2>
          </div>
          {user ? (
            <a
              className="group inline-flex h-11 shrink-0 items-center gap-2 bg-white px-5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--brand-soft)]"
              href="/workspace"
            >
              Create your first video
              <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" size={16} />
            </a>
          ) : (
            <TrialCtaLink sourcePage="landing-footer">
              Create your first video
            </TrialCtaLink>
          )}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
