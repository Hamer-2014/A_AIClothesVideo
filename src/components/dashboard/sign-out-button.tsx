"use client";

import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-medium hover:border-[var(--accent)]"
      onClick={signOut}
      type="button"
    >
      <LogOut aria-hidden="true" size={15} />
      Sign out
    </button>
  );
}
