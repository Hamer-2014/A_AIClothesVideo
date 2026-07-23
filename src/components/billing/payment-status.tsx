"use client";

import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2_000;
const MAX_ATTEMPTS = 30;

type PaymentState =
  | "checking"
  | "created"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "not_found"
  | "unauthorized"
  | "timeout";

interface PaymentStatusResponse {
  status: "created" | "paid" | "failed" | "cancelled" | "refunded";
  packageCode: string;
  creditsGranted: number;
}

function isPaymentStatusResponse(value: unknown): value is PaymentStatusResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    ["created", "paid", "failed", "cancelled", "refunded"].includes(
      String(record.status),
    ) &&
    typeof record.packageCode === "string" &&
    typeof record.creditsGranted === "number"
  );
}

function statusMessage(state: PaymentState, creditsGranted: number | null) {
  switch (state) {
    case "checking":
      return "Checking payment status...";
    case "created":
      return "Payment submitted. Waiting for secure confirmation...";
    case "paid":
      return `Payment confirmed. ${creditsGranted ?? 0} credits have been added.`;
    case "failed":
    case "cancelled":
      return "Payment was not completed.";
    case "refunded":
      return "This payment has been refunded.";
    case "not_found":
      return "We could not find this checkout. Check Billing for the latest status.";
    case "unauthorized":
      return "Your session expired. Sign in again to check this payment.";
    case "timeout":
      return "Confirmation is taking longer than expected. Check Billing for the latest status.";
  }
}

export function PaymentStatus({ externalOrderId }: { externalOrderId: string }) {
  const [state, setState] = useState<PaymentState>("checking");
  const [creditsGranted, setCreditsGranted] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function poll() {
      attempts += 1;

      try {
        const response = await fetch(
          `/api/billing/orders/${encodeURIComponent(externalOrderId)}`,
          { cache: "no-store" },
        );

        if (!active) return;
        if (response.status === 401) {
          setState("unauthorized");
          return;
        }
        if (response.status === 404) {
          setState("not_found");
          return;
        }

        const body: unknown = await response.json().catch(() => null);
        if (response.ok && isPaymentStatusResponse(body)) {
          setCreditsGranted(body.creditsGranted);
          setState(body.status);
          if (body.status !== "created") return;
        }
      } catch {
        // Transient network failures use the same bounded retry window.
      }

      if (!active) return;
      if (attempts >= MAX_ATTEMPTS) {
        setState("timeout");
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    void poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [externalOrderId]);

  const isWaiting = state === "checking" || state === "created";
  const isPaid = state === "paid";
  const Icon = isWaiting ? LoaderCircle : isPaid ? CheckCircle2 : CircleAlert;

  return (
    <p
      aria-live="polite"
      className="mt-3 flex items-start gap-2 text-sm leading-6 text-[var(--muted)]"
      role="status"
    >
      <Icon
        aria-hidden="true"
        className={isWaiting ? "mt-1 shrink-0 animate-spin" : "mt-1 shrink-0"}
        size={16}
      />
      <span>{statusMessage(state, creditsGranted)}</span>
    </p>
  );
}
