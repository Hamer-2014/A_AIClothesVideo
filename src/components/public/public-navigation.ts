import type { SiteLocale } from "@/lib/i18n/config";

export interface PublicNavigationItem {
  href: string;
  label: string;
}

export const publicNavigationItems = {
  en: [
    {
      href: "/three-images-to-clothing-video",
      label: "Three-image workflow",
    },
    { href: "/pricing", label: "Pricing" },
    { href: "/faq", label: "FAQ" },
  ],
  "zh-CN": [
    { href: "/three-images-to-clothing-video", label: "三图生成" },
    { href: "/pricing", label: "价格" },
    { href: "/faq", label: "常见问题" },
  ],
} satisfies Record<SiteLocale, readonly PublicNavigationItem[]>;
