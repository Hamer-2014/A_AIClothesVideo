"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";

import { authClient } from "@/lib/auth/client";

type EmailAction = "otp" | "magic-link";

type EmailRequestResult = {
  error?: {
    status?: number;
    retryAfterSeconds?: number;
  } | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_COOLDOWN_SECONDS = 60;

export function LoginForm({ callbackURL }: { callbackURL: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<EmailAction | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const emailRequestLock = useRef(false);
  const cooldownUntil = useRef(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timeout = window.setTimeout(() => {
      setCooldownSeconds(
        Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000)),
      );
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [cooldownSeconds]);

  const normalizedEmail = email.trim().toLowerCase();
  const emailActionsDisabled =
    !EMAIL_PATTERN.test(normalizedEmail) ||
    pendingAction !== null ||
    cooldownSeconds > 0;

  async function signInWithGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL,
    });
  }

  function startCooldown(seconds: number) {
    cooldownUntil.current = Date.now() + seconds * 1000;
    setCooldownSeconds(seconds);
  }

  async function runEmailAction(
    action: EmailAction,
    request: () => Promise<EmailRequestResult>,
    successMessage: string,
  ) {
    if (emailRequestLock.current || Date.now() < cooldownUntil.current) return;

    emailRequestLock.current = true;
    setPendingAction(action);
    setMessage(null);

    try {
      const result = await request();
      if (result.error) {
        if (result.error.status === 429) {
          const retryAfter = Math.max(
            1,
            result.error.retryAfterSeconds ?? EMAIL_COOLDOWN_SECONDS,
          );
          startCooldown(retryAfter);
          setMessage(`发送过于频繁，请在 ${retryAfter} 秒后重试。`);
        } else {
          setMessage("发送失败，请稍后重试。");
        }
        return;
      }

      startCooldown(EMAIL_COOLDOWN_SECONDS);
      setMessage(successMessage);
    } catch {
      setMessage("发送失败，请稍后重试。");
    } finally {
      emailRequestLock.current = false;
      setPendingAction(null);
    }
  }

  function sendOtp() {
    return runEmailAction(
      "otp",
      () =>
        authClient.emailOtp.sendVerificationOtp({
          email: normalizedEmail,
          type: "sign-in",
        }),
      "验证码已发送，请检查邮箱。",
    );
  }

  function sendMagicLink() {
    return runEmailAction(
      "magic-link",
      () =>
        authClient.signIn.magicLink({
          email: normalizedEmail,
          callbackURL,
        }),
      "登录链接已发送，请检查邮箱。",
    );
  }

  return (
    <div className="space-y-4">
      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white"
        onClick={signInWithGoogle}
        type="button"
      >
        <ShieldCheck aria-hidden="true" size={17} />
        使用 Google 登录
      </button>

      <label className="block text-sm font-medium" htmlFor="email">
        邮箱
      </label>
      <input
        className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pendingAction !== null}
        id="email"
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="seller@example.com"
        type="email"
        value={email}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          disabled={emailActionsDisabled}
          onClick={sendOtp}
          type="button"
        >
          <Mail aria-hidden="true" size={16} />
          {pendingAction === "otp"
            ? "发送中..."
            : cooldownSeconds > 0
              ? `验证码 ${cooldownSeconds} 秒后可重发`
              : "发送邮箱验证码"}
        </button>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          disabled={emailActionsDisabled}
          onClick={sendMagicLink}
          type="button"
        >
          <Mail aria-hidden="true" size={16} />
          {pendingAction === "magic-link"
            ? "发送中..."
            : cooldownSeconds > 0
              ? `Magic Link ${cooldownSeconds} 秒后可重发`
              : "发送 Magic Link"}
        </button>
      </div>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
