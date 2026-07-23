import Link from "next/link";

import { PaymentStatus } from "@/components/billing/payment-status";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const { order } = await searchParams;
  const externalOrderId = typeof order === "string" && order.trim() ? order : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 text-[var(--ink)]">
      <section className="w-full border border-[var(--line)] bg-[var(--surface-raised)] p-6">
        <h1 className="text-2xl font-semibold">Payment status</h1>
        {externalOrderId ? (
          <PaymentStatus externalOrderId={externalOrderId} />
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            We could not identify this checkout. Check Billing for the latest status.
          </p>
        )}
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
