import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Clothes Video",
  description: "上传 3 张服装图，生成可发布的商品宣传视频。",
  icons: {
    icon: [{ url: "/icon.svg?v=4", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg?v=4", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
