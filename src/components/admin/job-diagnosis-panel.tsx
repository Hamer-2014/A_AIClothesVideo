import type { AdminJobDiagnosis } from "@/server/admin/jobs";

const severityStyles: Record<AdminJobDiagnosis["severity"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-rose-200 bg-rose-50 text-rose-900",
};

export function JobDiagnosisPanel({
  diagnosis,
}: {
  diagnosis: AdminJobDiagnosis;
}) {
  return (
    <section className={`rounded-lg border p-5 ${severityStyles[diagnosis.severity]}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]">
            诊断摘要
          </p>
          <h2 className="mt-2 text-lg font-semibold">{diagnosis.title}</h2>
        </div>
        <p className="text-xs font-medium">
          {diagnosis.needsManualAction ? "需要人工处理" : "暂不需要人工处理"}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6">{diagnosis.recommendation}</p>
    </section>
  );
}
