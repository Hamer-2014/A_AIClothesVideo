import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getServerSession } from "@/lib/auth/server";

export default async function TermsPage() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader user={session?.user ?? null} />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">Terms of Service</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Before using AI Clothes Video, confirm that you have the right to use uploaded materials and understand that generation depends on material quality, content review, and model services.
        </p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Your uploaded materials</h2>
            <p className="mt-2">
              This service creates short promotional videos from clothing product images. Upload only product images, brand elements, and copy that you own or are authorized to use. You retain your rights and authorize us to process the materials for generation, quality checks, downloads, troubleshooting, and compliance review.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Prohibited content</h2>
            <p className="mt-2">
              Do not upload or generate NSFW, pornographic, sexually suggestive, hateful, violent, fraudulent, unlawful, or infringing content. You may not use an unauthorized real person, trademark, copyrighted material, deepfake, face swap, or impersonated endorsement. Do not use prompts to bypass material rules, content review, or free-trial limits.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Likeness and minor authorization</h2>
            <p className="mt-2">
              Before uploading material with an identifiable person, obtain their likeness and commercial promotional authorization. For anyone under 18, obtain authorization from a parent or guardian. Each server-side upload requires an active confirmation of the current authorization declaration; it is never preselected or accepted by us for you.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Free trial</h2>
            <p className="mt-2">
              The free trial is limited to one 8-second video for a new user: low resolution, no audio, a watermark, and low-risk shots only. Without a back-view image we do not generate a back view. Without a detail image we do not generate a detail close-up.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Generation failures</h2>
            <p className="mt-2">
              Video generation depends on material quality, model services, content review, and quality checks. We do not guarantee that every generation will be error-free or an exact reproduction. A provider failure, content block, unsuitable material, or failed quality check can prevent delivery.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Credits and refunds</h2>
            <p className="mt-2">
              Credits are normally reserved when generation is confirmed and captured only after the final video passes quality checks and is deliverable. If a job fails, is not generated, or cannot be delivered, reserved credits are released or returned according to status. Delivery does not eliminate all commercial-use risk.
            </p>
          </section>
          <section>
            <h2 className="text-base font-medium text-[var(--ink)]">Rights notices</h2>
            <p className="mt-2">
              Rights holders can submit a takedown request with a locatable content reference and rights explanation. The platform records a case number for administrator review. A notice does not automatically remove content, and bad-faith or incomplete requests may be rejected. Contact support@aiclothesvideo.com for support and rights notices.
            </p>
          </section>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
