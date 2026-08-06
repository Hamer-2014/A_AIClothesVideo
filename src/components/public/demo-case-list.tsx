import Image from "next/image";

import type { SiteLocale } from "@/lib/i18n/config";
import type { DemoCase, DemoSourceRole } from "@/lib/demo-cases/types";
import { localizedText } from "@/lib/demo-cases/types";

import { SampleVideo } from "./sample-video";

const roleLabels: Record<SiteLocale, Record<DemoSourceRole, string>> = {
  en: {
    front: "Front",
    side: "Side",
    back: "Back",
    detail: "Detail",
  },
  "zh-CN": {
    front: "正面",
    side: "侧面",
    back: "背面",
    detail: "细节",
  },
};

export function DemoCaseList({
  cases,
  language = "en",
}: {
  cases: readonly DemoCase[];
  language?: SiteLocale;
}) {
  const isChinese = language === "zh-CN";

  return (
    <ul
      aria-label={isChinese ? "演示素材集" : "Demo source sets"}
      className="border-y border-[var(--line-strong)]"
    >
      {cases.map((item, index) => {
        const title = localizedText(item.title, language);

        return (
          <li
            className="border-b border-[var(--line)] py-10 last:border-b-0 lg:py-14"
            key={item.slug}
          >
            <article
              aria-labelledby={`demo-case-${item.slug}`}
              className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-12"
            >
              <div className={`relative max-h-[680px] overflow-hidden bg-[var(--surface-subtle)] ${item.featuredOutput ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
                {item.featuredOutput ? (
                  <SampleVideo
                    ariaLabel={
                      isChinese
                        ? `由${title}素材生成的商品视频`
                        : `Generated ${title.toLowerCase()} product video`
                    }
                    className="size-full object-contain"
                    controls
                    language={language}
                    poster={item.featuredOutput.posterSrc}
                    sourcePage="examples"
                    src={item.featuredOutput.videoSrc}
                    testId="demo-case-video"
                  />
                ) : (
                  <Image
                    alt={
                      isChinese
                        ? `${title}主素材预览`
                        : `Primary source preview for ${title}`
                    }
                    className="size-full object-cover"
                    height={960}
                    src={item.featuredImage}
                    width={640}
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
                  <p className="text-xs font-semibold text-[var(--brand)]">
                    {String(index + 1).padStart(2, "0")} / {title}
                  </p>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {item.status === "published"
                      ? isChinese
                        ? "已发布工作流视频"
                        : "Published workflow video"
                      : isChinese
                        ? "合成素材已就绪"
                        : "Synthetic source set ready"}
                  </p>
                </div>

                <h2
                  className="mt-7 text-3xl font-semibold leading-tight sm:text-4xl"
                  id={`demo-case-${item.slug}`}
                >
                  {title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                  {localizedText(item.summary, language)}
                </p>
                <p className="mt-4 border-l-2 border-[var(--brand)] pl-4 text-sm leading-6 text-[var(--muted)]">
                  {localizedText(item.sourceNote, language)}
                </p>

                <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
                  {item.sourceAssets.map((asset) => (
                    <figure key={asset.role}>
                      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface-subtle)]">
                        <Image
                          alt={localizedText(asset.alt, language)}
                          className="size-full object-cover"
                          height={480}
                          src={asset.src}
                          width={360}
                        />
                      </div>
                      <figcaption className="mt-2 text-xs font-medium text-[var(--muted)]">
                        {roleLabels[language][asset.role]}
                      </figcaption>
                    </figure>
                  ))}
                </div>

                <p className="mt-7 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  {localizedText(item.boundaryNote, language)}
                </p>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
