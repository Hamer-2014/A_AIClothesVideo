import type { AppearanceView } from "./config";

type Match = "match" | "mismatch" | "unknown";

function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("qa_schema_error"); return value as Record<string, unknown>; }
function oneOf<T extends string>(value: unknown, values: readonly T[]): T { if (typeof value !== "string" || !values.includes(value as T)) throw new Error("qa_schema_error"); return value as T; }
function strings(value: unknown) { if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error("qa_schema_error"); return value as string[]; }

export type StrictViewQa = {
  verdict: "pass" | "fail" | "unknown";
  targetView: AppearanceView;
  garment: { silhouette: Match; color: Match; pattern: Match; visibleDetails: Match };
  person: { anatomy: "natural" | "abnormal" | "unknown"; identityConsistency: Match };
  inventedDetails: boolean | null;
  evidence: string[];
};

export type StrictCrossViewQa = {
  verdict: "pass" | "fail" | "unknown";
  coverage: "complete" | "incomplete" | "unknown";
  garmentConsistency: Match;
  personConsistency: Match;
  requiredViews: AppearanceView[];
  evidence: string[];
};

export function parseStrictViewQa(value: unknown): StrictViewQa {
  const root = record(value); const garment = record(root.garment); const person = record(root.person);
  return { verdict: oneOf(root.verdict, ["pass", "fail", "unknown"]), targetView: oneOf(root.targetView, ["front", "side", "back"]), garment: { silhouette: oneOf(garment.silhouette, ["match", "mismatch", "unknown"]), color: oneOf(garment.color, ["match", "mismatch", "unknown"]), pattern: oneOf(garment.pattern, ["match", "mismatch", "unknown"]), visibleDetails: oneOf(garment.visibleDetails, ["match", "mismatch", "unknown"]) }, person: { anatomy: oneOf(person.anatomy, ["natural", "abnormal", "unknown"]), identityConsistency: oneOf(person.identityConsistency, ["match", "mismatch", "unknown"]) }, inventedDetails: typeof root.inventedDetails === "boolean" ? root.inventedDetails : (() => { throw new Error("qa_schema_error"); })(), evidence: strings(root.evidence) };
}

export function parseStrictCrossViewQa(value: unknown): StrictCrossViewQa {
  const root = record(value); const requiredViews: AppearanceView[] = strings(root.requiredViews).map((item) => oneOf(item, ["front", "side", "back"]));
  return { verdict: oneOf(root.verdict, ["pass", "fail", "unknown"]), requiredViews, coverage: oneOf(root.coverage, ["complete", "incomplete", "unknown"]), garmentConsistency: oneOf(root.garmentConsistency, ["match", "mismatch", "unknown"]), personConsistency: oneOf(root.personConsistency, ["match", "mismatch", "unknown"]), evidence: strings(root.evidence) };
}

export function isStrictViewQaPass(value: StrictViewQa) {
  return value.verdict === "pass" && value.garment?.silhouette === "match" && value.garment.color === "match" && value.garment.pattern === "match" && value.garment.visibleDetails === "match" && value.person?.anatomy === "natural" && value.person.identityConsistency === "match" && value.inventedDetails === false;
}

export function isStrictCrossViewQaPass(value: StrictCrossViewQa) {
  return value.verdict === "pass" && value.coverage === "complete" && value.garmentConsistency === "match" && value.personConsistency === "match";
}
