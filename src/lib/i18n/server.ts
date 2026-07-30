import { headers } from "next/headers";

import { defaultLocale, type SiteLocale } from "./config";

export async function getRequestLocale(): Promise<SiteLocale> {
  const locale = (await headers()).get("x-site-locale");

  return locale === "zh-CN" ? "zh-CN" : defaultLocale;
}
