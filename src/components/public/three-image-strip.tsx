import Image from "next/image";

import type { SiteLocale } from "@/lib/i18n/config";

const threeImageSources = {
  en: [
    {
      alt: "Front appearance reference of an adult woman wearing a burgundy midi dress",
      label: "Front appearance",
      note: "Locks the visible person and front garment construction",
      src: "/demo/cases/burgundy-midi-dress/appearance-front.webp",
    },
    {
      alt: "Side appearance reference of an adult woman wearing a burgundy midi dress",
      label: "Side appearance",
      note: "Supports only the verified side pose and silhouette",
      src: "/demo/cases/burgundy-midi-dress/appearance-side.webp",
    },
    {
      alt: "Back appearance reference of an adult woman wearing a burgundy midi dress",
      label: "Back appearance",
      note: "Supports the verified back pose and construction",
      src: "/demo/cases/burgundy-midi-dress/appearance-back.webp",
    },
  ],
  "zh-CN": [
    {
      alt: "成人女性穿深酒红中长连衣裙的正面定妆参考",
      label: "正面定妆",
      note: "锁定可见人物与服装正面结构",
      src: "/demo/cases/burgundy-midi-dress/appearance-front.webp",
    },
    {
      alt: "成人女性穿深酒红中长连衣裙的侧面定妆参考",
      label: "侧面定妆",
      note: "仅支持已核验的侧面姿态与轮廓",
      src: "/demo/cases/burgundy-midi-dress/appearance-side.webp",
    },
    {
      alt: "成人女性穿深酒红中长连衣裙的背面定妆参考",
      label: "背面定妆",
      note: "支持已核验的背面姿态与结构",
      src: "/demo/cases/burgundy-midi-dress/appearance-back.webp",
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
