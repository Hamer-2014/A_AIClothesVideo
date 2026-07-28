interface LogoMarkProps {
  className?: string;
  size?: number;
}

interface LogoLockupProps {
  className?: string;
  labelClassName?: string;
  markSize?: number;
}

export function LogoMark({ className, size = 32 }: LogoMarkProps) {
  return (
    <span
      aria-label="AI Clothes Video"
      className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
      role="img"
      style={{ height: size, width: size }}
    >
      <svg
        aria-hidden="true"
        data-brand-mark="garment-motion"
        height={size}
        viewBox="0 0 40 40"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect fill="var(--brand)" height="40" rx="8" width="40" />
        <path
          d="M11 12 16 8c1 2 7 2 8 0l5 4 4 6-5 3-2-3v14H14V18l-2 3-5-3 4-6Z"
          data-garment-frame="1"
          fill="white"
          opacity="0.24"
          transform="translate(-4)"
        />
        <path
          d="M11 12 16 8c1 2 7 2 8 0l5 4 4 6-5 3-2-3v14H14V18l-2 3-5-3 4-6Z"
          data-garment-frame="2"
          fill="white"
          opacity="0.5"
        />
        <path
          d="M11 12 16 8c1 2 7 2 8 0l5 4 4 6-5 3-2-3v14H14V18l-2 3-5-3 4-6Z"
          data-garment-frame="3"
          fill="white"
          transform="translate(4)"
        />
        <path
          d="M16 8c1 2 7 2 8 0"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="1.4"
          transform="translate(4)"
        />
        <path
          d="m22 18.5 6 3.5-6 3.5Z"
          data-video-symbol="play"
          fill="var(--brand)"
        />
      </svg>
    </span>
  );
}

export function LogoLockup({
  className,
  labelClassName,
  markSize = 32,
}: LogoLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={markSize} />
      <span className={`whitespace-nowrap text-sm font-semibold text-[var(--ink)] sm:text-base ${labelClassName ?? ""}`}>
        AI Clothes Video
      </span>
    </span>
  );
}
