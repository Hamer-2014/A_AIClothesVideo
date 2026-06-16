"use client";

import { useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";

import { authClient } from "@/lib/auth/client";

export function LoginForm({ callbackURL }: { callbackURL: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL,
    });
  }

  async function sendOtp() {
    await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setMessage("验证码已发送，请检查邮箱。");
  }

  async function sendMagicLink() {
    await authClient.signIn.magicLink({
      email,
      callbackURL,
    });
    setMessage("登录链接已发送，请检查邮箱。");
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
        className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
        id="email"
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="seller@example.com"
        type="email"
        value={email}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium"
          disabled={!email}
          onClick={sendOtp}
          type="button"
        >
          <Mail aria-hidden="true" size={16} />
          发送邮箱验证码
        </button>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium"
          disabled={!email}
          onClick={sendMagicLink}
          type="button"
        >
          <Mail aria-hidden="true" size={16} />
          发送 Magic Link
        </button>
      </div>

      {message ? (
        <p className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
