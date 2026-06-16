import Image from "next/image";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

interface LogoLockupProps {
  className?: string;
  markSize?: number;
}

export function LogoMark({ className, size = 34 }: LogoMarkProps) {
  return (
    <Image
      alt="RunwayTools"
      className={className}
      height={size}
      priority
      src="/brand/logo.png"
      width={size}
    />
  );
}

export function LogoLockup({ className, markSize = 34 }: LogoLockupProps) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark size={markSize} />
      <div className="leading-none">
        <p className="text-base font-semibold tracking-normal text-[var(--ink)]">
          RunwayTools
        </p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
          Fashion video studio
        </p>
      </div>
    </div>
  );
}
