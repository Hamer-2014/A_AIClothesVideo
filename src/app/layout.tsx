import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Clothes Video",
  description: "上传 3 张服装图，生成可发布的商品宣传视频。",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/brand/logo.png", sizes: "512x512", type: "image/png" }],
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
