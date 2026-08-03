import type { Metadata } from "next";

import { GuidesIndex } from "@/components/public/guide-pages";
import { getServerSession } from "@/lib/auth/server";
import { guideIndexCopy } from "@/lib/guides/catalog";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = guideIndexCopy[locale];
  const canonical = locale === "zh-CN" ? "/zh/guides" : "/guides";

  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: {
      canonical,
      languages: {
        en: "/guides",
        "zh-CN": "/zh/guides",
        "x-default": "/guides",
      },
    },
  };
}

export default async function GuidesIndexPage() {
  const [session, locale] = await Promise.all([
    getServerSession(),
    getRequestLocale(),
  ]);

  return <GuidesIndex language={locale} user={session?.user ?? null} />;
}
