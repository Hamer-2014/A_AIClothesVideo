export function normalizeSmokeMode(value) {
  const mode = value?.trim() || "full";
  if (mode === "stitch" || mode === "full") {
    return mode;
  }

  throw new Error(`Unsupported SMOKE_MODE: ${mode}`);
}

export function resolveSmokeJobId({ argv = [], env = process.env } = {}) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--job-id") {
      return argv[index + 1]?.trim() || "";
    }
    if (arg.startsWith("--job-id=")) {
      return arg.slice("--job-id=".length).trim();
    }
  }

  return env.JOB_ID?.trim() || "";
}

export function buildMissingJobIdMessage({ mode, candidates = [] }) {
  const scriptName = mode === "stitch" ? "smoke:stitch" : "smoke:backend";
  const sampleId = candidates[0]?.id ?? "your-video-job-id";
  const lines = [
    "JOB_ID is required.",
    "",
    `PowerShell example: $env:JOB_ID='${sampleId}'; npm run ${scriptName}`,
    `CLI example: npm run ${scriptName} -- --job-id ${sampleId}`,
  ];

  if (candidates.length > 0) {
    lines.push("", "Recent candidate jobs:");
    for (const candidate of candidates) {
      lines.push(
        `- ${candidate.id} | status=${candidate.status} | is_test=${candidate.is_test} | updated_at=${candidate.updated_at}`,
      );
    }
  }

  return lines.join("\n");
}

export function shouldTriggerStitch({
  jobStatus,
  stitchStatus,
}) {
  if (jobStatus === "stitching_queued") {
    return stitchStatus !== "running" && stitchStatus !== "succeeded";
  }

  if (jobStatus === "stitching_running") {
    return false;
  }

  if (
    jobStatus === "post_qa_queued" ||
    jobStatus === "post_qa_running" ||
    jobStatus === "post_qa_passed" ||
    jobStatus === "post_qa_failed" ||
    jobStatus === "deliverable" ||
    jobStatus === "failed_released" ||
    jobStatus === "failed_refunded"
  ) {
    return false;
  }

  return stitchStatus !== "running" && stitchStatus !== "succeeded";
}

export function buildSmokeArtifactKeys(jobId) {
  return {
    finalVideoKey: `jobs/${jobId}/stitched/final.mp4`,
    framePrefix: `jobs/${jobId}/qa/frames/`,
  };
}

export function classifySmokeOutcome({
  mode,
  jobStatus,
  stitchStatus,
  postQaStatus,
}) {
  if (jobStatus === "failed_released" || jobStatus === "failed_refunded") {
    return {
      done: true,
      success: false,
      reason: jobStatus,
    };
  }

  if (stitchStatus === "failed") {
    return {
      done: true,
      success: false,
      reason: "stitch_failed",
    };
  }

  if (mode === "stitch") {
    if (
      stitchStatus === "succeeded" &&
      (
        jobStatus === "post_qa_queued" ||
        jobStatus === "post_qa_running" ||
        jobStatus === "post_qa_passed" ||
        jobStatus === "post_qa_failed" ||
        jobStatus === "deliverable" ||
        jobStatus === "failed_released" ||
        jobStatus === "failed_refunded"
      )
    ) {
      return {
        done: true,
        success: true,
        reason: "stitch_completed",
      };
    }

    return {
      done: false,
      success: false,
      reason: "waiting_for_stitch",
    };
  }

  if (jobStatus === "deliverable" && postQaStatus === "passed") {
    return {
      done: true,
      success: true,
      reason: "deliverable",
    };
  }

  if (jobStatus === "post_qa_failed" || postQaStatus === "failed") {
    return {
      done: true,
      success: false,
      reason: "post_qa_failed",
    };
  }

  return {
    done: false,
    success: false,
    reason: "waiting_for_post_qa",
  };
}

export function assertSmokeCreditLedger({ mode, job, ledger = [] }) {
  if (mode !== "full") {
    return;
  }

  const rawCreditCost = job?.credit_cost ?? job?.creditCost;
  if (rawCreditCost === undefined || rawCreditCost === null) {
    throw new Error("Full smoke job snapshot is missing credit_cost.");
  }

  const creditCost = Number(rawCreditCost);
  if (creditCost <= 0) {
    return;
  }

  const ledgerTypes = ledger.map((entry) => entry.type);
  if (!ledgerTypes.includes("capture")) {
    throw new Error(
      `Full smoke expected credit capture for paid job (${creditCost} credits), but ledger only has: ${ledgerTypes.join(", ")}`,
    );
  }
}
