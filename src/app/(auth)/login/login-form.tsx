"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import type { SiteLocale } from "@/lib/i18n/config";

type AuthAction = "google" | "otp" | "otp-verify";

type EmailRequestResult = {
  error?: {
    code?: string;
    status?: number;
    retryAfterSeconds?: number;
  } | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_COOLDOWN_SECONDS = 60;

const formCopy = {
  en: {
    googleFailed: "Google sign-in failed. Please try again.",
    tooMany: (seconds: number) => `Too many requests. Try again in ${seconds} seconds.`,
    sendFailed: "Could not send the code. Please try again.",
    sent: "We sent a sign-in code to your email.",
    invalid: "Invalid code. Check it and try again.",
    expired: "This code has expired. Request a new code.",
    attempts: "Too many attempts. Request a new code.",
    verifyFailed: "Could not verify the code. Please try again.",
    google: "Sign in with Google", redirecting: "Redirecting...", email: "Email",
    change: "Change email", send: "Send email code", sending: "Sending...",
    resend: (seconds: number) => `Resend in ${seconds}s`,
    retryLabel: (seconds: number) => `Send email code, retry in ${seconds} seconds`,
    code: "Email code", placeholder: "6-digit code", verify: "Verify and sign in", verifying: "Verifying...",
  },
  "zh-CN": {
    googleFailed: "Google 登录失败，请重试。",
    tooMany: (seconds: number) => `请求过于频繁，请在 ${seconds} 秒后重试。`,
    sendFailed: "验证码发送失败，请重试。",
    sent: "登录验证码已发送到你的邮箱。",
    invalid: "验证码无效，请检查后重试。",
    expired: "验证码已过期，请重新获取。",
    attempts: "尝试次数过多，请重新获取验证码。",
    verifyFailed: "验证码校验失败，请重试。",
    google: "使用 Google 登录", redirecting: "正在跳转...", email: "邮箱",
    change: "更换邮箱", send: "发送邮箱验证码", sending: "正在发送...",
    resend: (seconds: number) => `${seconds} 秒后重新发送`,
    retryLabel: (seconds: number) => `发送邮箱验证码，${seconds} 秒后可重试`,
    code: "邮箱验证码", placeholder: "6 位数字验证码", verify: "验证并登录", verifying: "正在验证...",
  },
} as const;

export function LoginForm({ callbackURL, language = "en" }: { callbackURL: string; language?: SiteLocale }) {
  const copy = formCopy[language];
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AuthAction | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const authActionLock = useRef(false);
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
    if (authActionLock.current) return;

    authActionLock.current = true;
    setPendingAction("google");
    setMessage(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      if (result.error) setMessage(copy.googleFailed);
    } catch {
      setMessage(copy.googleFailed);
    } finally {
      authActionLock.current = false;
      setPendingAction(null);
    }
  }

  function startCooldown(seconds: number) {
    cooldownUntil.current = Date.now() + seconds * 1000;
    setCooldownSeconds(seconds);
  }

  async function runEmailAction(
    request: () => Promise<EmailRequestResult>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    if (authActionLock.current || Date.now() < cooldownUntil.current) return;

    authActionLock.current = true;
    setPendingAction("otp");
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
          setMessage(copy.tooMany(retryAfter));
        } else {
          setMessage(copy.sendFailed);
        }
        return;
      }

      startCooldown(EMAIL_COOLDOWN_SECONDS);
      onSuccess?.();
      setMessage(successMessage);
    } catch {
      setMessage(copy.sendFailed);
    } finally {
      authActionLock.current = false;
      setPendingAction(null);
    }
  }

  function sendOtp() {
    return runEmailAction(
      () =>
        authClient.emailOtp.sendVerificationOtp({
          email: normalizedEmail,
          type: "sign-in",
        }),
      copy.sent,
      () => {
        setOtp("");
        setOtpEmail(normalizedEmail);
      },
    );
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authActionLock.current || !otpEmail || !/^\d{6}$/.test(otp)) return;

    authActionLock.current = true;
    setPendingAction("otp-verify");
    setMessage(null);

    try {
      const result = await authClient.signIn.emailOtp({
        email: otpEmail,
        otp,
      });
      if (result.error) {
        const errorMessages: Record<string, string> = {
          INVALID_OTP: copy.invalid,
          OTP_EXPIRED: copy.expired,
          TOO_MANY_ATTEMPTS: copy.attempts,
        };
        setMessage(
          errorMessages[result.error.code ?? ""] ??
            copy.verifyFailed,
        );
        return;
      }

      router.replace(callbackURL);
      router.refresh();
    } catch {
      setMessage(copy.verifyFailed);
    } finally {
      authActionLock.current = false;
      setPendingAction(null);
    }
  }

  function changeEmail() {
    setOtp("");
    setOtpEmail(null);
    setMessage(null);
  }

  return (
    <div className="space-y-4">
      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white"
        disabled={pendingAction !== null}
        onClick={signInWithGoogle}
        type="button"
      >
        <ShieldCheck aria-hidden="true" size={17} />
        {pendingAction === "google" ? copy.redirecting : copy.google}
      </button>

      <div className="flex items-center justify-between gap-4">
        <label className="block text-sm font-medium" htmlFor="email">
          {copy.email}
        </label>
        {otpEmail ? (
          <button
            className="text-sm font-medium text-[var(--accent)]"
            disabled={pendingAction !== null}
            onClick={changeEmail}
            type="button"
          >
            {copy.change}
          </button>
        ) : null}
      </div>
      <input
        className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pendingAction !== null || otpEmail !== null}
        id="email"
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="seller@example.com"
        type="email"
        value={email}
      />

      <div>
        <button
          aria-label={
            cooldownSeconds > 0
              ? copy.retryLabel(cooldownSeconds)
              : undefined
          }
          className="flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
          disabled={emailActionsDisabled}
          onClick={sendOtp}
          type="button"
        >
          <Mail aria-hidden="true" size={16} />
          {pendingAction === "otp"
            ? copy.sending
            : cooldownSeconds > 0
              ? copy.resend(cooldownSeconds)
              : copy.send}
        </button>
      </div>

      {otpEmail ? (
        <form className="space-y-3" onSubmit={verifyOtp}>
          <label className="block text-sm font-medium" htmlFor="email-otp">
            {copy.code}
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              autoComplete="one-time-code"
              autoFocus
              className="h-11 min-w-0 rounded-md border border-[var(--line)] bg-white px-3 text-center text-base font-medium tracking-[0.16em] outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingAction !== null}
              id="email-otp"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              pattern="[0-9]{6}"
              placeholder={copy.placeholder}
              type="text"
              value={otp}
            />
            <button
              className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingAction !== null || !/^\d{6}$/.test(otp)}
              type="submit"
            >
              <KeyRound aria-hidden="true" size={16} />
              {pendingAction === "otp-verify" ? copy.verifying : copy.verify}
            </button>
          </div>
        </form>
      ) : null}

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
