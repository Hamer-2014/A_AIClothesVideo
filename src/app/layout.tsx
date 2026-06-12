import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RunwayTools",
  description: "服装商品图生成宣传短视频工具站",
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
