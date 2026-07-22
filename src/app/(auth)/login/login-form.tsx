"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";

type AuthAction = "google" | "otp" | "otp-verify" | "magic-link";

type EmailRequestResult = {
  error?: {
    code?: string;
    status?: number;
    retryAfterSeconds?: number;
  } | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_COOLDOWN_SECONDS = 60;

export function LoginForm({ callbackURL }: { callbackURL: string }) {
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
      if (result.error) setMessage("Google 登录失败，请稍后重试。");
    } catch {
      setMessage("Google 登录失败，请稍后重试。");
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
    action: Extract<AuthAction, "otp" | "magic-link">,
    request: () => Promise<EmailRequestResult>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    if (authActionLock.current || Date.now() < cooldownUntil.current) return;

    authActionLock.current = true;
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
      onSuccess?.();
      setMessage(successMessage);
    } catch {
      setMessage("发送失败，请稍后重试。");
    } finally {
      authActionLock.current = false;
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
      () => {
        setOtp("");
        setOtpEmail(normalizedEmail);
      },
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

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      authActionLock.current ||
      !otpEmail ||
      !/^\d{6}$/.test(otp)
    ) {
      return;
    }

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
          INVALID_OTP: "验证码错误，请检查后重试。",
          OTP_EXPIRED: "验证码已过期，请重新发送。",
          TOO_MANY_ATTEMPTS: "尝试次数过多，请重新发送验证码。",
        };
        setMessage(
          errorMessages[result.error.code ?? ""] ??
            "验证码验证失败，请稍后重试。",
        );
        return;
      }

      router.replace(callbackURL);
      router.refresh();
    } catch {
      setMessage("验证码验证失败，请稍后重试。");
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
        {pendingAction === "google" ? "跳转中..." : "使用 Google 登录"}
      </button>

      <div className="flex items-center justify-between gap-4">
        <label className="block text-sm font-medium" htmlFor="email">
          邮箱
        </label>
        {otpEmail ? (
          <button
            className="text-sm font-medium text-[var(--accent)]"
            disabled={pendingAction !== null}
            onClick={changeEmail}
            type="button"
          >
            更换邮箱
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

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          aria-label={
            cooldownSeconds > 0
              ? `发送邮箱验证码，${cooldownSeconds} 秒后可重发`
              : undefined
          }
          className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
          disabled={emailActionsDisabled}
          onClick={sendOtp}
          type="button"
        >
          <Mail aria-hidden="true" size={16} />
          {pendingAction === "otp"
            ? "发送中..."
            : cooldownSeconds > 0
              ? `验证码 ${cooldownSeconds}s`
              : "发送邮箱验证码"}
        </button>
        <button
          aria-label={
            cooldownSeconds > 0
              ? `发送 Magic Link，${cooldownSeconds} 秒后可重发`
              : undefined
          }
          className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
          disabled={emailActionsDisabled}
          onClick={sendMagicLink}
          type="button"
        >
          <Mail aria-hidden="true" size={16} />
          {pendingAction === "magic-link"
            ? "发送中..."
            : cooldownSeconds > 0
              ? `Magic Link ${cooldownSeconds}s`
              : "发送 Magic Link"}
        </button>
      </div>

      {otpEmail ? (
        <form className="space-y-3" onSubmit={verifyOtp}>
          <label className="block text-sm font-medium" htmlFor="email-otp">
            邮箱验证码
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
              placeholder="6 位验证码"
              type="text"
              value={otp}
            />
            <button
              className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingAction !== null || !/^\d{6}$/.test(otp)}
              type="submit"
            >
              <KeyRound aria-hidden="true" size={16} />
              {pendingAction === "otp-verify" ? "验证中..." : "验证并登录"}
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
