"use client";

import Link from "next/link";

import { trackFunnelEvent } from "@/lib/analytics/client-funnel";

export function TrackedMarketingLink({
  children,
  className,
  destination,
  sourcePage,
}: {
  children: React.ReactNode;
  className?: string;
  destination: string;
  sourcePage: string;
}) {
  return (
    <Link
      className={className}
      href={destination}
      onClick={() => {
        void trackFunnelEvent("landing_exit_clicked", {
          sourcePage,
          destination,
        });
      }}
    >
      {children}
    </Link>
  );
}
