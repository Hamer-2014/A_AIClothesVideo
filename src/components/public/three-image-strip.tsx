import Image from "next/image";

import type { SiteLocale } from "@/lib/i18n/config";

const threeImageSources = {
  en: [
    {
      alt: "Front product image of a red dress",
      label: "Front image",
      note: "Defines the garment and its overall silhouette",
      src: "/demo/red-dress-front.webp",
    },
    {
      alt: "Back image of a red dress",
      label: "Back image",
      note: "Supports views of the actual back construction",
      src: "/demo/red-dress-back.webp",
    },
    {
      alt: "Detail image of a red dress",
      label: "Detail image",
      note: "Supports close-ups of visible fabric or construction",
      src: "/demo/red-dress-detail.webp",
    },
  ],
  "zh-CN": [
    {
      alt: "红色连衣裙正面主图",
      label: "正面主图",
      note: "确认服装主体与整体轮廓",
      src: "/demo/red-dress-front.webp",
    },
    {
      alt: "红色连衣裙背面图",
      label: "背面图",
      note: "支持真实背部结构展示",
      src: "/demo/red-dress-back.webp",
    },
    {
      alt: "红色连衣裙细节图",
      label: "细节图",
      note: "支持可见面料或工艺特写",
      src: "/demo/red-dress-detail.webp",
    },
  ],
} as const;

export function ThreeImageStrip({
  compact = false,
  language = "en",
}: {
  compact?: boolean;
  language?: SiteLocale;
}) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden bg-[var(--line-strong)]">
      {threeImageSources[language].map((image, index) => (
        <figure className="group min-w-0 bg-[var(--surface-raised)]" key={image.src}>
          <div className={`relative overflow-hidden bg-[var(--surface-subtle)] ${compact ? "aspect-[4/5]" : "aspect-[2/3]"}`}>
            <Image
              alt={image.alt}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 767px) 33vw, 20vw"
              src={image.src}
              unoptimized
            />
          </div>
          <figcaption className="border-t border-[var(--line)] px-2 py-3 sm:px-4 sm:py-4">
            <p className="text-[11px] text-[var(--muted)]">0{index + 1}</p>
            <p className="mt-1 text-sm font-semibold">{image.label}</p>
            <p className="mt-1 hidden text-xs leading-5 text-[var(--muted)] sm:block">
              {image.note}
            </p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
