import { describe, expect, it } from "vitest";

import { isStrictCrossViewQaPass, isStrictViewQaPass, type StrictViewQa } from "./qa-schema";

describe("virtual try-on strict QA", () => {
  it("fails closed for unknown results", () => {
    expect(isStrictViewQaPass({ verdict: "unknown" } as StrictViewQa)).toBe(false);
    expect(isStrictCrossViewQaPass({ verdict: "pass", coverage: "incomplete", garmentConsistency: "match", personConsistency: "match" })).toBe(false);
  });
});
