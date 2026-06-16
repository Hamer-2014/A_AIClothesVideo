import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RunwayTools",
  description: "服装商品图生成宣传短视频工具站",
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
