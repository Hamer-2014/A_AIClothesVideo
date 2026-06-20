"use client";

import Link from "next/link";

import { trackFunnelEvent } from "@/lib/analytics/client-funnel";

export function trialWorkspaceHref() {
  return "/workspace?mode=trial&preset=minimal_studio";
}

export function loginTrialHref() {
  return `/login?next=${encodeURIComponent(trialWorkspaceHref())}`;
}

export function TrialCtaLink({
  children = "免费生成 1 条试用视频",
  sourcePage = "landing",
}: {
  children?: React.ReactNode;
  sourcePage?: string;
}) {
  return (
    <Link
      className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
      href={loginTrialHref()}
      onClick={() => {
        void trackFunnelEvent("trial_cta_clicked", {
          sourcePage,
          presetId: "minimal_studio",
          mode: "trial",
        });
      }}
    >
      {children}
    </Link>
  );
}
