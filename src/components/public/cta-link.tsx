import Link from "next/link";

export function trialWorkspaceHref() {
  return "/workspace?mode=trial&preset=minimal_studio";
}

export function loginTrialHref() {
  return `/login?next=${encodeURIComponent(trialWorkspaceHref())}`;
}

export function TrialCtaLink({
  children = "免费生成 1 条试用视频",
}: {
  children?: React.ReactNode;
}) {
  return (
    <Link
      className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
      href={loginTrialHref()}
    >
      {children}
    </Link>
  );
}
