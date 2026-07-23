import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";
import { SUPPORT_EMAIL } from "@/lib/support-email";

export default async function AcceptableUsePage() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">Acceptable Use Policy</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          AI Clothes Video is for authorized clothing product promotion. Use it only for lawful, accurate product-video workflows.
        </p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">You must not use the service for</h2>
            <p className="mt-2">
              NSFW, pornographic, or sexually suggestive content; hate or violence; fraud or deception; deepfakes, face swaps, or impersonated endorsements; and unauthorized use of a real person, trademark, copyright, or other protected material.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Materials and product accuracy</h2>
            <p className="mt-2">
              Upload only materials you are authorized to use. Do not ask the service to invent garment features that are not present in your source images. A missing back-view image cannot produce a back view, and a missing detail image cannot produce a detail close-up.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Enforcement</h2>
            <p className="mt-2">
              We may block or remove prohibited requests, suspend access, and preserve information required for safety, fraud prevention, or legal compliance. For questions or rights notices, contact {SUPPORT_EMAIL}.
            </p>
          </section>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
