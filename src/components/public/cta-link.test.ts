import { describe, expect, it } from "vitest";

import { loginTrialHref, trialWorkspaceHref } from "./cta-link";

describe("public CTA links", () => {
  it("builds the trial workspace and login redirect hrefs", () => {
    expect(trialWorkspaceHref()).toBe(
      "/workspace?mode=trial&preset=minimal_studio",
    );
    expect(loginTrialHref()).toBe(
      "/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio",
    );
  });
});
