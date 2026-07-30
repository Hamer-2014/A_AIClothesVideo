export type SiteLocale = "en" | "zh-CN";

export const defaultLocale: SiteLocale = "en";
export const chinesePrefix = "/zh";

export function localeFromPathname(pathname: string): SiteLocale {
  return pathname === chinesePrefix || pathname.startsWith(`${chinesePrefix}/`)
    ? "zh-CN"
    : defaultLocale;
}

export function stripLocalePrefix(pathname: string): string {
  if (pathname === chinesePrefix) {
    return "/";
  }

  if (pathname.startsWith(`${chinesePrefix}/`)) {
    return pathname.slice(chinesePrefix.length) || "/";
  }

  return pathname;
}

export function localizeHref(href: string, locale: SiteLocale): string {
  if (!href.startsWith("/") || href.startsWith("//")) {
    return href;
  }

  const suffixStart = href.search(/[?#]/);
  const pathname = suffixStart === -1 ? href : href.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? "" : href.slice(suffixStart);
  const unprefixedPathname = stripLocalePrefix(pathname || "/");

  if (locale === "en") {
    return `${unprefixedPathname}${suffix}`;
  }

  const localizedPathname =
    unprefixedPathname === "/"
      ? chinesePrefix
      : `${chinesePrefix}${unprefixedPathname}`;

  return `${localizedPathname}${suffix}`;
}
