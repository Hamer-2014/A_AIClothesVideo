import type { AppearanceView } from "./config";

type Match = "match" | "mismatch" | "unknown";

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
};

export function isStrictViewQaPass(value: StrictViewQa) {
  return value.verdict === "pass" && value.garment?.silhouette === "match" && value.garment.color === "match" && value.garment.pattern === "match" && value.garment.visibleDetails === "match" && value.person?.anatomy === "natural" && value.person.identityConsistency === "match" && value.inventedDetails === false;
}

export function isStrictCrossViewQaPass(value: StrictCrossViewQa) {
  return value.verdict === "pass" && value.coverage === "complete" && value.garmentConsistency === "match" && value.personConsistency === "match";
}
