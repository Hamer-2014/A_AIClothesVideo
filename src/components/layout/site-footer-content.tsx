import Link from "next/link";

export function SiteFooterContent() {
  return (
    <>
      <p>2026 RunwayTools. All rights reserved.</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p>服装商品图生成宣传短视频工具</p>
        <nav aria-label="页脚链接" className="flex flex-wrap gap-4">
          <Link href="/privacy">隐私</Link>
          <Link href="/terms">条款</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/pricing">价格</Link>
          <Link href="/takedown">侵权删除</Link>
        </nav>
      </div>
    </>
  );
}
