import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { loginTrialHref, TrialCtaLink, trialWorkspaceHref } from "./cta-link";

describe("public CTA links", () => {
  it("builds the trial workspace and login redirect hrefs", () => {
    expect(trialWorkspaceHref()).toBe(
      "/workspace?mode=trial&preset=minimal_studio",
    );
    expect(loginTrialHref()).toBe(
      "/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio",
    );
  });

  it("renders the safe public trial CTA href", () => {
    const html = renderToStaticMarkup(createElement(TrialCtaLink));

    expect(html).toContain(
      'href="/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio"',
    );
    expect(html).toContain("免费生成 1 条试用视频");
  });
});
