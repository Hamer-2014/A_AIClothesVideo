import { describe, expect, it } from "vitest";

import { isStrictCrossViewQaPass, isStrictViewQaPass, parseStrictCrossViewQa, parseStrictViewQa, type StrictViewQa } from "./qa-schema";

describe("virtual try-on strict QA", () => {
  it("fails closed for unknown results", () => {
    expect(isStrictViewQaPass({ verdict: "unknown" } as StrictViewQa)).toBe(false);
    expect(isStrictCrossViewQaPass({ verdict: "pass", requiredViews: ["front"], coverage: "incomplete", garmentConsistency: "match", personConsistency: "match", evidence: [] })).toBe(false);
  });
  it("rejects missing nested fields", () => {
    expect(() => parseStrictViewQa({ verdict: "pass", targetView: "front", observedView: "front", garment: {}, person: {}, inventedDetails: false, evidence: [] })).toThrow("qa_schema_error");
  });
  it("fails closed when a valid view result is bound to the wrong target", () => {
    const qa = parseStrictViewQa({ verdict: "pass", targetView: "front", observedView: "front", garment: { silhouette: "match", color: "match", pattern: "match", visibleDetails: "match" }, person: { anatomy: "natural", identityConsistency: "match" }, inventedDetails: false, evidence: [] });
    expect(isStrictViewQaPass(qa, "side")).toBe(false);
  });
  it("fails closed when the observed image orientation differs from the assigned target", () => {
    const qa = parseStrictViewQa({ verdict: "pass", targetView: "front", observedView: "back", garment: { silhouette: "match", color: "match", pattern: "match", visibleDetails: "match" }, person: { anatomy: "natural", identityConsistency: "match" }, inventedDetails: false, evidence: [] });
    expect(isStrictViewQaPass(qa, "front")).toBe(false);
  });
  it("fails closed when a cross result has an out-of-order or incomplete view set", () => {
    const qa = parseStrictCrossViewQa({ verdict: "pass", requiredViews: ["front", "back", "side"], coverage: "complete", garmentConsistency: "match", personConsistency: "match", evidence: [] });
    expect(isStrictCrossViewQaPass(qa, ["front", "side", "back"])).toBe(false);
  });
});
