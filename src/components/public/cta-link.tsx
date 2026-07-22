"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
      className="group inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--action)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--action-hover)]"
      href={trialWorkspaceHref()}
      onClick={() => {
        void trackFunnelEvent("trial_cta_clicked", {
          sourcePage,
          presetId: "minimal_studio",
          mode: "trial",
        });
      }}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
        size={16}
      />
    </Link>
  );
}
