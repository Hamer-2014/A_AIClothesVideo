interface JobUpgradePanelProps {
  billingMode?: string | null;
  downloadReady: boolean;
  phase: string;
}

export function JobUpgradePanel({
  billingMode,
  downloadReady,
  phase,
}: JobUpgradePanelProps) {
  if (billingMode !== "free_trial") {
    return null;
  }

  if (downloadReady || phase === "deliverable") {
    return (
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">试用视频已生成</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              当前试用视频为 8 秒、低分辨率、无音频、带水印。购买点数后可以生成高清无水印版本。
            </p>
          </div>
          <a
            className="inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
            href="/pricing"
          >
            生成高清无水印版本
          </a>
        </div>
      </section>
    );
  }

  if (phase === "failed") {
    return (
      <section className="rounded-lg border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">试用任务未成功</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              可以先查看失败说明；购买点数后仍可按素材规则创建新的高清无水印任务。
            </p>
          </div>
          <a
            className="inline-flex h-10 items-center rounded-md border border-[var(--line)] px-4 text-sm font-medium"
            href="/pricing"
          >
            购买点数
          </a>
        </div>
      </section>
    );
  }

  return null;
}
