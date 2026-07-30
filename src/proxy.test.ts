import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

describe("locale proxy", () => {
  it("marks unprefixed pages as English without rewriting them", () => {
    const response = proxy(new NextRequest("https://example.com/pricing"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-site-locale")).toBe(
      "en",
    );
  });

  it("marks Chinese URLs without rewriting them", () => {
    const response = proxy(
      new NextRequest("https://example.com/zh/pricing?package=starter"),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-site-locale")).toBe(
      "zh-CN",
    );
  });

  it("serves the Chinese root without rewriting it", () => {
    const response = proxy(new NextRequest("https://example.com/zh"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("ignores a client-provided locale header on an English URL", () => {
    const response = proxy(
      new NextRequest("https://example.com/pricing", {
        headers: { "x-site-locale": "zh-CN" },
      }),
    );

    expect(response.headers.get("x-middleware-request-x-site-locale")).toBe(
      "en",
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it.each([
    "/api/jobs",
    "/zh/api/jobs",
    "/_next/static/chunks/app.js",
    "/zh/_next/static/chunks/app.js",
    "/_next/image",
    "/zh/_next/image",
    "/favicon.ico",
    "/zh/favicon.ico",
  ])("does not match internal or asset path %s", (pathname) => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: `https://example.com${pathname}`,
      }),
    ).toBe(false);
  });
});
