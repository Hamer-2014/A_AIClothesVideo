import type { Metadata } from "next";
import Script from "next/script";

import type { SiteLocale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";

import "./globals.css";

export function buildRootMetadata(locale: SiteLocale): Metadata {
  return {
    title: "AI Clothes Video",
    description:
      locale === "zh-CN"
        ? "上传 3 张服装图，生成可发布的商品宣传视频。"
        : "Upload three clothing images to create a product marketing video.",
    manifest: "/manifest.webmanifest?v=1",
    icons: {
      icon: [
        { url: "/icon.svg?v=4", type: "image/svg+xml" },
        { url: "/favicon.ico?v=1", sizes: "any" },
      ],
      shortcut: [{ url: "/favicon.ico?v=1", sizes: "any" }],
      apple: [
        { url: "/apple-icon.png?v=1", sizes: "180x180", type: "image/png" },
      ],
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return buildRootMetadata(await getRequestLocale());
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body>
        {children}
        <Script
          id="google-analytics-loader"
          src="https://www.googletagmanager.com/gtag/js?id=G-NDXCM536QP"
          strategy="afterInteractive"
        />
        <Script id="google-analytics-config" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-NDXCM536QP');`}
        </Script>
      </body>
    </html>
  );
}
