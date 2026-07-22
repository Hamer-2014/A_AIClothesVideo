import { Play } from "lucide-react";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

interface LogoLockupProps {
  className?: string;
  markSize?: number;
}

export function LogoMark({ className, size = 32 }: LogoMarkProps) {
  return (
    <span
      aria-label="AI Clothes Video"
      className={`inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--brand)] text-white ${className ?? ""}`}
      role="img"
      style={{ height: size, width: size }}
    >
      <Play aria-hidden="true" fill="currentColor" size={Math.round(size * 0.48)} />
    </span>
  );
}

export function LogoLockup({ className, markSize = 32 }: LogoLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={markSize} />
      <span className="whitespace-nowrap text-sm font-semibold text-[var(--ink)] sm:text-base">
        AI Clothes Video
      </span>
    </span>
  );
}
