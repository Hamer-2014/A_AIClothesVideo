const paidNextSteps = [
  "Create or select a real job with credit_cost > 0.",
  "Run npm run smoke:backend -- --job-id <paid-job-id>.",
  "Confirm credit_ledger contains reserve and capture for that job.",
];

const failureNextSteps = [
  "Run a paid job through a provider, stitch, or Post-QA failure path.",
  "Mark the job undeliverable or let Post-QA resolve failure release credits.",
  "Confirm credit_ledger contains release or refund and job_state_events explain the transition.",
];

const auditNextSteps = [
  "Execute at least one sensitive admin operation that writes admin_audit_logs.",
  "Verify provider key create/rotate or credit adjustment appears in /admin/audit-logs.",
];

function result({ passed, name, reason, jobId = null, evidence = null, nextSteps = [] }) {
  return {
    name,
    passed,
    reason,
    jobId,
    evidence,
    nextSteps,
  };
}

export function evaluatePaidDeliveryEvidence(jobs) {
  if (jobs.length === 0) {
    return result({
      name: "paid_delivery",
      passed: false,
      reason: "No paid deliverable job with credit_cost > 0 was found.",
      nextSteps: paidNextSteps,
    });
  }

  const failures = [];
  for (const job of jobs) {
    const ledgerTypes = new Set(job.ledgerTypes ?? []);
    if (!ledgerTypes.has("reserve")) {
      failures.push(`${job.id} missing reserve`);
      continue;
    }
    if (!ledgerTypes.has("capture")) {
      failures.push(`${job.id} missing capture`);
      continue;
    }
    if (!job.finalVideoKey) {
      failures.push(`${job.id} missing final video key`);
      continue;
    }
    if (!job.qaFrameCount || job.qaFrameCount <= 0) {
      failures.push(`${job.id} missing QA frames`);
      continue;
    }

    return result({
      name: "paid_delivery",
      passed: true,
      reason: "Paid deliverable job has reserve, capture, final video, and QA frames.",
      jobId: job.id,
      evidence: job,
    });
  }

  return result({
    name: "paid_delivery",
    passed: false,
    reason: `Paid delivery evidence incomplete: ${failures.join("; ")}.`,
    evidence: jobs,
    nextSteps: paidNextSteps,
  });
}

export function evaluateFailureCompensationEvidence(jobs) {
  if (jobs.length === 0) {
    return result({
      name: "failure_compensation",
      passed: false,
      reason: "No failed compensated paid job with release/refund evidence was found.",
      nextSteps: failureNextSteps,
    });
  }

  const failures = [];
  for (const job of jobs) {
    const ledgerTypes = new Set(job.ledgerTypes ?? []);
    if (!ledgerTypes.has("release") && !ledgerTypes.has("refund")) {
      failures.push(`${job.id} missing release/refund`);
      continue;
    }
    if (!job.stateEventCount || job.stateEventCount <= 0) {
      failures.push(`${job.id} missing state events`);
      continue;
    }

    return result({
      name: "failure_compensation",
      passed: true,
      reason: "Failed paid job has release/refund ledger and state event evidence.",
      jobId: job.id,
      evidence: job,
    });
  }

  return result({
    name: "failure_compensation",
    passed: false,
    reason: `Failure compensation evidence incomplete: ${failures.join("; ")}.`,
    evidence: jobs,
    nextSteps: failureNextSteps,
  });
}

export function evaluateAuditEvidence(actions) {
  const requiredActions = [
    "provider_key:create",
    "provider_key:rotate",
    "credits:admin_adjust",
    "job:mark_undeliverable",
    "job:retry_segment",
    "job:reopen_post_qa",
  ];
  const counts = new Map(actions.map((item) => [item.action, Number(item.count)]));
  const present = requiredActions.filter((action) => (counts.get(action) ?? 0) > 0);

  if (present.length === 0) {
    return result({
      name: "audit_evidence",
      passed: false,
      reason: "No required sensitive admin audit actions were found.",
      evidence: actions,
      nextSteps: auditNextSteps,
    });
  }

  return result({
    name: "audit_evidence",
    passed: true,
    reason: `Sensitive admin audit evidence found: ${present.join(", ")}.`,
    evidence: actions,
  });
}

export function buildBlockerVerificationReport({
  paidDelivery,
  failureCompensation,
  auditEvidence,
}) {
  const checks = [paidDelivery, failureCompensation, auditEvidence];
  const passed = checks.every((check) => check.passed);

  return {
    passed,
    summary: passed
      ? "PASS: backend/API blocker evidence is complete."
      : "BLOCKED: backend/API blocker evidence is incomplete.",
    checks,
  };
}
