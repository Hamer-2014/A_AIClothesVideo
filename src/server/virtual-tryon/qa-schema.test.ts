import { describe, expect, it } from "vitest";

import { isStrictCrossViewQaPass, isStrictViewQaPass, parseStrictViewQa, type StrictViewQa } from "./qa-schema";

describe("virtual try-on strict QA", () => {
  it("fails closed for unknown results", () => {
    expect(isStrictViewQaPass({ verdict: "unknown" } as StrictViewQa)).toBe(false);
    expect(isStrictCrossViewQaPass({ verdict: "pass", requiredViews: ["front"], coverage: "incomplete", garmentConsistency: "match", personConsistency: "match", evidence: [] })).toBe(false);
  });
  it("rejects missing nested fields", () => {
    expect(() => parseStrictViewQa({ verdict: "pass", targetView: "front", garment: {}, person: {}, inventedDetails: false, evidence: [] })).toThrow("qa_schema_error");
  });
});
