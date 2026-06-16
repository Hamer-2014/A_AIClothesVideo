import { describe, expect, it } from "vitest";

import {
  authRedirectFallback,
  buildLoginHrefForRedirect,
  buildRelativePathWithQuery,
  sanitizeAuthRedirect,
} from "./redirects";

describe("auth redirects", () => {
  it("keeps same-site relative workspace trial redirects", () => {
    expect(
      sanitizeAuthRedirect("/workspace?mode=trial&preset=minimal_studio"),
    ).toBe("/workspace?mode=trial&preset=minimal_studio");
  });

  it("falls back when next points outside the site", () => {
    expect(sanitizeAuthRedirect("https://evil.example/workspace")).toBe(
      authRedirectFallback,
    );
    expect(sanitizeAuthRedirect("//evil.example/workspace")).toBe(
      authRedirectFallback,
    );
    expect(sanitizeAuthRedirect("/\\evil.example/workspace")).toBe(
      authRedirectFallback,
    );
  });

  it("builds login hrefs with an encoded sanitized next path", () => {
    expect(
      buildLoginHrefForRedirect("/workspace?mode=trial&preset=minimal_studio"),
    ).toBe("/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio");
    expect(buildLoginHrefForRedirect("https://evil.example")).toBe(
      "/login?next=%2Fworkspace",
    );
  });

  it("serializes the current workspace path and query for unauthenticated redirects", () => {
    expect(
      buildRelativePathWithQuery("/workspace", {
        mode: "trial",
        preset: "minimal_studio",
      }),
    ).toBe("/workspace?mode=trial&preset=minimal_studio");
  });
});
