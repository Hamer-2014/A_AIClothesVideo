import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Check } from "lucide-react";

import { TrialCtaLink } from "@/components/public/cta-link";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { ThreeImageStrip } from "@/components/public/three-image-strip";
import {
  guideArticles,
  guideIndexCopy,
  guidePath,
  guideSlugs,
  type GuideArticle,
  type GuideTextPart,
} from "@/lib/guides/catalog";
import { localizeHref, type SiteLocale } from "@/lib/i18n/config";

interface PublicUser {
  name?: string | null;
  email?: string | null;
}

function RichParagraph({
  language,
  parts,
}: {
  language: SiteLocale;
  parts: readonly GuideTextPart[];
}) {
  return (
    <p className="mt-5 text-base leading-8 text-[var(--muted)] first:mt-0">
      {parts.map((part, index) => typeof part === "string" ? part : (
        <Link
          className="font-semibold text-[var(--ink)] underline decoration-[var(--line-strong)] underline-offset-4 hover:text-[var(--brand)] hover:decoration-[var(--brand)]"
          href={localizeHref(part.href, language)}
          key={`${part.href}-${index}`}
        >
          {part.label}
        </Link>
      ))}
    </p>
  );
}

export function GuidesIndex({
  language,
  user,
}: {
  language: SiteLocale;
  user?: PublicUser | null;
}) {
  const copy = guideIndexCopy[language];

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader language={language} sourcePage="guides" user={user} />

      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <p className="text-sm font-semibold text-[var(--brand-light)]">{copy.eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
            {copy.intro}
          </p>
          <Link
            className="mt-8 inline-flex min-h-11 items-center gap-2 border-b border-white/45 text-sm font-semibold text-white hover:border-white"
            href={localizeHref("/three-images-to-clothing-video", language)}
          >
            {copy.parentLabel}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </section>

      <section className="border-b border-[var(--line)] bg-[var(--surface-raised)]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
          <ThreeImageStrip compact language={language} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="border-y border-[var(--line-strong)]">
          {guideSlugs.map((slug, index) => {
            const guide = guideArticles[slug];
            const article = guide[language];

            return (
              <article
                className="grid gap-7 border-b border-[var(--line)] py-9 last:border-b-0 lg:grid-cols-[4rem_minmax(0,1fr)_18rem] lg:items-center"
                key={slug}
              >
                <p className="text-xs font-semibold text-[var(--brand)]">0{index + 1}</p>
                <div>
                  <h2 className="max-w-3xl text-2xl font-semibold leading-snug sm:text-3xl">
                    <Link
                      className="hover:text-[var(--brand)]"
                      href={localizeHref(guidePath(slug), language)}
                    >
                      {article.title}
                    </Link>
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                    {article.description}
                  </p>
                  <Link
                    aria-label={`${copy.articleLabel}: ${article.title}`}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-[var(--brand)]"
                    href={localizeHref(guidePath(slug), language)}
                  >
                    {copy.articleLabel}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-subtle)]">
                  <Image
                    alt={article.imageAlt}
                    className="object-contain"
                    fill
                    sizes="(max-width: 1023px) 100vw, 288px"
                    src={guide.imageSrc}
                    unoptimized
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface-subtle)]">
        <div className="mx-auto grid max-w-7xl gap-7 px-5 py-14 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:px-12">
          <BookOpen aria-hidden="true" className="text-[var(--brand)]" size={28} />
          <div>
            <h2 className="text-2xl font-semibold">{copy.evidenceTitle}</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">
              {copy.evidenceBody}
            </p>
          </div>
        </div>
      </section>

      <PublicFooter language={language} />
    </main>
  );
}

export function GuideArticlePage({
  guide,
  language,
  user,
}: {
  guide: GuideArticle;
  language: SiteLocale;
  user?: PublicUser | null;
}) {
  const article = guide[language];
  const isChinese = language === "zh-CN";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
      <PublicHeader language={language} sourcePage={`guide_${guide.slug}`} user={user} />

      <article>
        <header className="bg-[var(--surface-raised)]">
          <div className="mx-auto max-w-5xl px-5 pb-14 pt-10 sm:px-8 sm:pb-18 lg:px-12 lg:pb-20">
            <nav aria-label={isChinese ? "面包屑" : "Breadcrumb"} className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <Link className="hover:text-[var(--ink)]" href={localizeHref("/", language)}>
                {isChinese ? "首页" : "Home"}
              </Link>
              <span aria-hidden="true">/</span>
              <Link className="hover:text-[var(--ink)]" href={localizeHref("/guides", language)}>
                {isChinese ? "实用指南" : "Guides"}
              </Link>
            </nav>
            <p className="mt-10 text-sm font-semibold text-[var(--brand)]">{article.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {article.title}
            </h1>
            <p className="mt-7 max-w-3xl border-l-4 border-[var(--brand)] pl-5 text-lg leading-8 text-[var(--ink)] sm:text-xl sm:leading-9">
              {article.directAnswer}
            </p>
            <Link
              className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:text-[var(--brand)]"
              href={localizeHref(guide.parentHref, language)}
            >
              {article.parentLabel}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <figure className="border-y border-[var(--line)] bg-[var(--surface-subtle)]">
            <div className="relative mx-auto aspect-[16/9] max-h-[680px] max-w-7xl overflow-hidden">
              <Image
                alt={article.imageAlt}
                className="object-contain"
                fill
                priority
                sizes="100vw"
                src={guide.imageSrc}
                unoptimized
              />
            </div>
            <figcaption className="mx-auto max-w-5xl px-5 py-4 text-xs leading-5 text-[var(--muted)] sm:px-8 lg:px-12">
              {article.imageCaption}
            </figcaption>
          </figure>
        </header>

        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
          {article.sections.map((section, sectionIndex) => (
            <section
              className="border-b border-[var(--line)] py-10 first:pt-0 last:border-b-0"
              key={section.heading}
            >
              <p className="text-xs font-semibold text-[var(--brand)]">{String(sectionIndex + 1).padStart(2, "0")}</p>
              <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-snug sm:text-3xl">
                {section.heading}
              </h2>
              <div className="mt-6 max-w-3xl">
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <RichParagraph
                    key={`${section.heading}-${paragraphIndex}`}
                    language={language}
                    parts={paragraph}
                  />
                ))}
              </div>

              {section.bullets ? (
                <ul className="mt-7 max-w-3xl space-y-3 border-l border-[var(--line-strong)] pl-5 text-sm leading-7 text-[var(--muted)]">
                  {section.bullets.map((item) => (
                    <li className="flex gap-3" key={item}>
                      <Check aria-hidden="true" className="mt-1 shrink-0 text-[var(--success)]" size={16} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {section.numberedItems ? (
                <ol className="mt-7 max-w-3xl border-y border-[var(--line-strong)]">
                  {section.numberedItems.map((item, itemIndex) => (
                    <li className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-[var(--line)] py-4 text-sm leading-7 last:border-b-0" key={item}>
                      <span className="text-xs font-semibold text-[var(--brand)]">{String(itemIndex + 1).padStart(2, "0")}</span>
                      <span className="text-[var(--muted)]">{item}</span>
                    </li>
                  ))}
                </ol>
              ) : null}

              {section.table ? (
                <div className="mt-7 overflow-x-auto border-y border-[var(--line-strong)]">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr>
                        {section.table.headers.map((header) => (
                          <th className="py-4 pr-6 font-semibold last:pr-0" key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-[var(--muted)]">
                      {section.table.rows.map((row) => (
                        <tr className="border-t border-[var(--line)]" key={row.join("-")}>
                          {row.map((cell, cellIndex) => (
                            <td className={`py-4 pr-6 last:pr-0 ${cellIndex === 0 ? "font-medium text-[var(--ink)]" : ""}`} key={cell}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </article>

      <section className="border-y border-[var(--line)] bg-[var(--surface-subtle)]">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:px-12">
          <h2 className="text-xl font-semibold">{article.relatedHeading}</h2>
          <nav aria-label={article.relatedHeading} className="mt-6 border-y border-[var(--line-strong)]">
            {guide.relatedSlugs.map((relatedSlug) => {
              const related = guideArticles[relatedSlug][language];
              return (
                <Link
                  className="group flex min-h-16 items-center justify-between gap-5 border-b border-[var(--line)] py-4 text-sm font-semibold last:border-b-0 hover:text-[var(--brand)]"
                  href={localizeHref(guidePath(relatedSlug), language)}
                  key={relatedSlug}
                >
                  <span>{related.title}</span>
                  <ArrowRight aria-hidden="true" className="shrink-0 transition-transform group-hover:translate-x-0.5" size={16} />
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="bg-[var(--brand)] text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-7 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:px-12">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">{article.ctaTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">{article.ctaBody}</p>
          </div>
          <TrialCtaLink
            ariaLabel={article.ctaLabel}
            ctaPosition="guide_final"
            locale={language}
            sourcePage={`guide_${guide.slug}`}
          >
            {article.ctaLabel}
          </TrialCtaLink>
        </div>
      </section>

      <PublicFooter language={language} />
    </main>
  );
}
