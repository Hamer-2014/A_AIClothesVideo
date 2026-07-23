import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 text-[var(--ink)]">
      <section className="w-full border border-[var(--line)] bg-[var(--surface-raised)] p-6">
        <h1 className="text-2xl font-semibold">Payment received</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Payment received, credits will appear after webhook confirmation.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="text-sm font-medium text-[var(--action)]" href="/billing">
            View billing
          </Link>
          <Link className="text-sm font-medium text-[var(--action)]" href="/workspace">
            Back to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
