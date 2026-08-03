import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideArticlePage as GuideArticleView } from "@/components/public/guide-pages";
import { getServerSession } from "@/lib/auth/server";
import {
  guideArticles,
  guidePath,
  guideSlugs,
  isGuideSlug,
} from "@/lib/guides/catalog";
import { localizeHref } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return guideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  if (!isGuideSlug(slug)) return {};

  const copy = guideArticles[slug][locale];
  const englishPath = guidePath(slug);
  const chinesePath = localizeHref(englishPath, "zh-CN");

  return {
    title: copy.metadataTitle,
    description: copy.description,
    alternates: {
      canonical: localizeHref(englishPath, locale),
      languages: {
        en: englishPath,
        "zh-CN": chinesePath,
        "x-default": englishPath,
      },
    },
  };
}

export default async function GuideArticlePage({ params }: GuidePageProps) {
  const [{ slug }, session, locale] = await Promise.all([
    params,
    getServerSession(),
    getRequestLocale(),
  ]);

  if (!isGuideSlug(slug)) notFound();

  return (
    <GuideArticleView
      guide={guideArticles[slug]}
      language={locale}
      user={session?.user ?? null}
    />
  );
}
