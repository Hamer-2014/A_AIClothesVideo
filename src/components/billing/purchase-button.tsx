"use client";

import Link from "next/link";
import { CreditCard, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

type PackageCode = "starter" | "creator" | "studio";

interface PurchaseButtonProps {
  authenticated: boolean;
  packageCode: PackageCode;
  packageName: string;
  purchasesEnabled: boolean;
  navigate?: (url: string) => void;
}

function defaultNavigate(url: string) {
  window.location.assign(url);
}

function loginHref(packageCode: PackageCode) {
  const next = `/pricing?package=${packageCode}#credit-packs`;
  return `/login?next=${encodeURIComponent(next)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function PurchaseButton({
  authenticated,
  packageCode,
  packageName,
  purchasesEnabled,
  navigate = defaultNavigate,
}: PurchaseButtonProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestLock = useRef(false);

  if (!purchasesEnabled) {
    return (
      <button
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled
        type="button"
      >
        <CreditCard aria-hidden="true" size={16} />
        Purchases temporarily unavailable
      </button>
    );
  }

  if (!authenticated) {
    return (
      <Link
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--action)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
        href={loginHref(packageCode)}
      >
        <CreditCard aria-hidden="true" size={16} />
        Sign in to buy {packageName}
      </Link>
    );
  }

  async function startCheckout() {
    if (requestLock.current) return;

    requestLock.current = true;
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageCode }),
      });
      const body = asRecord(await response.json().catch(() => null));

      if (!response.ok) {
        setMessage(
          response.status === 401
            ? "Your session expired. Sign in and try again."
            : response.status === 502 || response.status === 503
              ? "Purchases are temporarily unavailable. Please try again later."
              : "Checkout could not be opened. Please try again.",
        );
        return;
      }

      if (typeof body.checkoutUrl !== "string" || !body.checkoutUrl) {
        setMessage("Checkout could not be opened. Please try again.");
        return;
      }

      navigate(body.checkoutUrl);
    } catch {
      setMessage("Checkout could not be opened. Please try again.");
    } finally {
      requestLock.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--action)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)] disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        onClick={startCheckout}
        type="button"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
        ) : (
          <CreditCard aria-hidden="true" size={16} />
        )}
        {pending ? "Opening secure checkout..." : `Buy ${packageName}`}
      </button>
      {message ? (
        <p
          aria-live="polite"
          className="mt-2 text-sm leading-5 text-[var(--danger)]"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
