"use client";

import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth/client";

export function SignOutButton({
  compact = false,
  label = "Sign out",
}: {
  compact?: boolean;
  label?: string;
} = {}) {
  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      aria-label={label}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white text-sm font-medium hover:border-[var(--accent)] ${compact ? "px-2 sm:px-3" : "px-3"}`}
      onClick={signOut}
      type="button"
    >
      <LogOut aria-hidden="true" size={15} />
      <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
    </button>
  );
}
