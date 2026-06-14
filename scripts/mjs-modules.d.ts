declare module "*.mjs" {
  export function normalizeSmokeMode(
    value?: string | undefined,
  ): "stitch" | "full";

  export function resolveSmokeJobId(input?: {
    argv?: string[] | undefined;
    env?: Record<string, string | undefined> | undefined;
  }): string;

  export function buildMissingJobIdMessage(input: {
    mode: "stitch" | "full";
    candidates?: Array<{
      id: string;
      status: string;
      is_test: boolean;
      updated_at: string;
    }>;
  }): string;

  export function shouldTriggerStitch(input: {
    mode?: "stitch" | "full";
    jobStatus: string | null;
    stitchStatus: string | null;
  }): boolean;

  export function buildSmokeArtifactKeys(jobId: string): {
    finalVideoKey: string;
    framePrefix: string;
  };

  export function classifySmokeOutcome(input: {
    mode: "stitch" | "full";
    jobStatus: string | null;
    stitchStatus: string | null;
    postQaStatus: string | null;
  }): {
    done: boolean;
    success: boolean;
    reason: string;
  };

  export function assertSmokeCreditLedger(input: {
    mode: "stitch" | "full";
    job: { credit_cost?: number | null; creditCost?: number | null } | null;
    ledger?: Array<{ type: string }>;
  }): void;

  export interface BlockerCheckResult {
    name: string;
    passed: boolean;
    reason: string;
    jobId: string | null;
    evidence: unknown;
    nextSteps: string[];
  }

  export function evaluatePaidDeliveryEvidence(
    jobs: Array<{
      id: string;
      status: string;
      creditCost: number;
      ledgerTypes?: string[];
      finalVideoKey?: string | null;
      qaFrameCount?: number;
      videoProviders?: string[];
      videoModels?: string[];
      providerLogProviders?: string[];
      providerLogModels?: string[];
      videoProviderLogCount?: number;
    }>,
  ): BlockerCheckResult;

  export function evaluateFailureCompensationEvidence(
    jobs: Array<{
      id: string;
      status: string;
      creditCost: number;
      ledgerTypes?: string[];
      stateEventCount?: number;
    }>,
  ): BlockerCheckResult;

  export function evaluateAuditEvidence(
    actions: Array<{ action: string; count: number }>,
  ): BlockerCheckResult;

  export function buildBlockerVerificationReport(input: {
    paidDelivery: BlockerCheckResult;
    failureCompensation: BlockerCheckResult;
    auditEvidence: BlockerCheckResult;
  }): {
    passed: boolean;
    summary: string;
    checks: BlockerCheckResult[];
  };
}
