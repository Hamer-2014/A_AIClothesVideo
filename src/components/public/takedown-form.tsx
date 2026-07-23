"use client";

import { useState, type FormEvent } from "react";

export function TakedownForm({
  legalContactEmail,
}: {
  legalContactEmail: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const contentReferences = String(form.get("contentReferences") ?? "")
      .split(/\r?\n/)
      .map((reference) => reference.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/compliance/rights-removal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName: form.get("reporterName"),
          reporterEmail: form.get("reporterEmail"),
          rightsType: form.get("rightsType"),
          contentReferences,
          description: form.get("description"),
          goodFaithConfirmed: form.get("goodFaithConfirmed") === "on",
          accuracyConfirmed: form.get("accuracyConfirmed") === "on",
          companyWebsite: form.get("companyWebsite"),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        reference?: string;
        error?: string;
      } | null;

      if (!response.ok || !body?.reference) {
        setError(
          response.status === 429
            ? "Too many submissions. Please try again later."
            : "We could not submit your notice. Check the information and try again.",
        );
        return;
      }
      setReference(body.reference);
    } catch {
      setError("We could not submit your notice. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <section aria-live="polite" className="space-y-4">
        <h2 className="text-lg font-medium text-[var(--ink)]">Rights notice received</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Public reference: <strong className="text-[var(--ink)]">{reference}</strong>
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Save this reference. We review the materials before taking action; submitting a notice does not automatically remove content.
        </p>
        {legalContactEmail ? (
          <p className="text-sm text-[var(--muted)]">
            Send additional information to
            <a
              className="ml-1 underline focus-visible:outline-2 focus-visible:outline-offset-2"
              href={`mailto:${legalContactEmail}`}
            >
              {legalContactEmail}
            </a>
          </p>
        ) : null}
      </section>
    );
  }

  const inputClass =
    "mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-[var(--ink)]">
          Your name
          <input
            className={inputClass}
            maxLength={100}
            minLength={2}
            name="reporterName"
            required
          />
        </label>
        <label className="text-sm font-medium text-[var(--ink)]">
          Email address
          <input
            className={inputClass}
            maxLength={254}
            name="reporterEmail"
            required
            type="email"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-[var(--ink)]">
        Type of right
        <select className={inputClass} defaultValue="" name="rightsType" required>
          <option disabled value="">Select a right</option>
          <option value="likeness">Likeness</option>
          <option value="copyright">Copyright</option>
          <option value="trademark">Trademark</option>
          <option value="privacy">Privacy</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="block text-sm font-medium text-[var(--ink)]">
        Content references
        <textarea
          className={inputClass}
          maxLength={2504}
          name="contentReferences"
          placeholder="One job URL, video URL, or locatable reference per line, up to 5 items"
          required
          rows={4}
        />
      </label>

      <label className="block text-sm font-medium text-[var(--ink)]">
        Description of your rights
        <textarea
          className={inputClass}
          maxLength={5000}
          minLength={50}
          name="description"
          required
          rows={8}
        />
      </label>

      <div className="space-y-3 text-sm leading-6 text-[var(--muted)]">
        <label className="flex items-start gap-3">
          <input
            className="mt-1 h-4 w-4 shrink-0"
            name="goodFaithConfirmed"
            required
            type="checkbox"
          />
          <span>I have a good-faith belief that the reported content uses these rights without authorization.</span>
        </label>
        <label className="flex items-start gap-3">
          <input
            className="mt-1 h-4 w-4 shrink-0"
            name="accuracyConfirmed"
            required
            type="checkbox"
          />
          <span>I confirm that this information is accurate and complete, and I agree to be contacted for verification.</span>
        </label>
      </div>

      <label aria-hidden="true" className="sr-only">
        Company website
        <input
          autoComplete="off"
          name="companyWebsite"
          tabIndex={-1}
        />
      </label>

      {error ? (
        <p aria-live="polite" className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Submitting..." : "Submit rights notice"}
      </button>
    </form>
  );
}
