"use client";

import Link from "next/link";
import { CreditCard, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { localizeHref, type SiteLocale } from "@/lib/i18n/config";

type PackageCode = "starter" | "creator" | "studio";

interface PurchaseButtonProps {
  authenticated: boolean;
  packageCode: PackageCode;
  packageName: string;
  purchasesEnabled: boolean;
  language?: SiteLocale;
  selected?: boolean;
  navigate?: (url: string) => void;
}

function defaultNavigate(url: string) {
  window.location.assign(url);
}

function loginHref(packageCode: PackageCode, language: SiteLocale) {
  const next = localizeHref(`/pricing?package=${packageCode}`, language);
  return localizeHref(`/login?next=${encodeURIComponent(next)}`, language);
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
  language = "en",
  selected = false,
  navigate = defaultNavigate,
}: PurchaseButtonProps) {
  const isChinese = language === "zh-CN";
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestLock = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authenticated && purchasesEnabled && selected) {
      containerRef.current?.scrollIntoView?.({ block: "center" });
    }
  }, [authenticated, purchasesEnabled, selected]);

  if (!purchasesEnabled) {
    return (
      <button
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled
        type="button"
      >
        <CreditCard aria-hidden="true" size={16} />
        {isChinese ? "购买暂时不可用" : "Purchases temporarily unavailable"}
      </button>
    );
  }

  if (!authenticated) {
    return (
      <Link
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--action)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--action)]"
        href={loginHref(packageCode, language)}
      >
        <CreditCard aria-hidden="true" size={16} />
        {isChinese ? `登录购买 ${packageName}` : `Sign in to buy ${packageName}`}
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
            ? isChinese ? "登录状态已过期，请重新登录。" : "Your session expired. Sign in and try again."
            : response.status === 502 || response.status === 503
              ? isChinese ? "购买暂时不可用，请稍后重试。" : "Purchases are temporarily unavailable. Please try again later."
              : isChinese ? "无法打开结账页面，请重试。" : "Checkout could not be opened. Please try again.",
        );
        return;
      }

      if (typeof body.checkoutUrl !== "string" || !body.checkoutUrl) {
        setMessage(isChinese ? "无法打开结账页面，请重试。" : "Checkout could not be opened. Please try again.");
        return;
      }

      navigate(body.checkoutUrl);
    } catch {
      setMessage(isChinese ? "无法打开结账页面，请重试。" : "Checkout could not be opened. Please try again.");
    } finally {
      requestLock.current = false;
      setPending(false);
    }
  }

  return (
    <div className="mt-5" ref={containerRef}>
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
        {pending
          ? isChinese ? "正在打开安全结账..." : "Opening secure checkout..."
          : selected
            ? isChinese ? "继续结账" : "Continue to checkout"
            : isChinese ? `购买 ${packageName}` : `Buy ${packageName}`}
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
