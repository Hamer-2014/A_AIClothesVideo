import Image from "next/image";

interface VideoPlaceholderProps {
  aspect?: "portrait" | "landscape";
  className?: string;
  description?: string;
  label: string;
  variant?: "thumbnail" | "preview";
}

export function VideoPlaceholder({
  aspect = "landscape",
  className = "",
  description,
  label,
  variant = "preview",
}: VideoPlaceholderProps) {
  const sizeClass =
    variant === "thumbnail"
      ? "h-20 w-14 flex-none"
      : "mx-auto mt-5 w-full max-w-3xl";
  const aspectClass =
    variant === "thumbnail"
      ? "aspect-[7/10]"
      : aspect === "portrait"
        ? "aspect-[9/16] max-w-sm"
        : "aspect-video";
  const labelClass =
    variant === "thumbnail"
      ? "text-[10px] leading-3"
      : "text-sm font-medium";

  return (
    <div
      aria-label={`视频默认${variant === "thumbnail" ? "缩略图" : "预览"}：${label}`}
      className={`${sizeClass} ${aspectClass} relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] ${className}`}
      role="img"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-95"
        fill
        priority={variant === "thumbnail"}
        sizes={variant === "thumbnail" ? "56px" : "(min-width: 1024px) 768px, 100vw"}
        src="/brand/default-video.png"
      />
      <div className="absolute inset-0 bg-white/35" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-2 text-center">
        <span className={labelClass}>{label}</span>
        {description && variant === "preview" ? (
          <span className="mt-2 max-w-md text-xs leading-5 text-[var(--muted)]">
            {description}
          </span>
        ) : null}
      </div>
    </div>
  );
}
