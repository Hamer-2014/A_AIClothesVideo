import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import type { SiteLocale } from "@/lib/i18n/config";

export function PolicyPage({
  intro,
  language,
  sections,
  sourcePage,
  title,
  user,
}: {
  intro: string;
  language: SiteLocale;
  sections: readonly (readonly [string, string])[];
  sourcePage: string;
  title: string;
  user?: { name?: string | null; email?: string | null } | null;
}) {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader language={language} sourcePage={sourcePage} user={user} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{intro}</p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted)]">
          {sections.map(([heading, body]) => <section key={heading}><h2 className="text-base font-medium text-[var(--ink)]">{heading}</h2><p className="mt-2">{body}</p></section>)}
        </div>
      </article>
      <PublicFooter language={language} />
    </main>
  );
}
