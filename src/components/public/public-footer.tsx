import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-[var(--muted)]">
        <p>RunwayTools · 服装商品图生成宣传短视频工具</p>
        <div className="flex gap-4">
          <Link href="/privacy">隐私</Link>
          <Link href="/terms">条款</Link>
          <Link href="/pricing">价格</Link>
        </div>
      </div>
    </footer>
  );
}
