import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";

export default async function PrivacyPage() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">Privacy Policy</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          This Privacy Policy explains how AI Clothes Video handles your uploaded materials, generated results, and account data.
        </p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Uploaded images</h2>
            <p className="mt-2">
              We use your clothing product images, back views, detail images, scene references, and generated results to create video jobs, show history, provide downloads, troubleshoot, and meet compliance obligations. Upload only material you have the right to use.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Model processing</h2>
            <p className="mt-2">
              The generation workflow sends necessary images, material analysis, user-provided text, and final video prompts to model providers for analysis, storyboard generation, video generation, and quality checks. We do not expose API keys, internal safety signals, or full provider debugging data to regular users.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Cloudflare R2</h2>
            <p className="mt-2">
              Uploaded images, video segments, final videos, covers, and quality-check frames are stored in private Cloudflare R2 object storage. Access uses short-lived signed URLs; the bucket is not a public directory.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Retention</h2>
            <p className="mt-2">
              Uploaded originals and final videos are normally retained for about 180 days; video segments and ordinary quality-check frames for about 30 days. Files connected to incidents or appeals may be retained longer for troubleshooting. Billing, order, and required audit records are retained as needed for compliance and reconciliation.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Deletion</h2>
            <p className="mt-2">
              You may request deletion of job materials or account data. Deletion is normally marked in the database first, then an asynchronous cleanup removes R2 files. Completed orders, credit ledgers, and safety audit records may need to be retained.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Notices and complaints</h2>
            <p className="mt-2">
              Upload authorization declarations retain the declaration version, text snapshot, linked material, and a de-identified request summary. Rights notices retain the reporter contact, rights type, redacted content reference, explanation, status, and audit record. Closed complaints and declarations no longer linked to active materials are de-identified after a three years retention period; public reference numbers, status, and necessary audit relationships may remain.
            </p>
          </section>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
