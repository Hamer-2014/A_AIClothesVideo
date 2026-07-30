import { NextRequest, NextResponse } from "next/server";

import { localeFromPathname } from "@/lib/i18n/config";

export function proxy(request: NextRequest) {
  const pathLocale = localeFromPathname(request.nextUrl.pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-site-locale", pathLocale);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!(?:zh/)?(?:api|_next)(?:/|$)|(?:zh/)?favicon\\.ico$|.*\\..*).*)",
  ],
};
