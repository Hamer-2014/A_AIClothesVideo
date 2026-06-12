"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function modeForDuration(durationSeconds: number) {
  return durationSeconds === 8 ? "lite" : "standard";
}

export function AnalyzeRetryButton({
  jobId,
  durationSeconds,
}: {
  jobId: string;
  durationSeconds: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retryAnalyze() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeForDuration(durationSeconds),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { message?: string | null }
        | null;

      if (!response.ok) {
        setMessage(body?.message ?? "素材分析失败，请稍后重试。");
        return;
      }

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "素材分析失败，请稍后重试。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        className="inline-flex h-10 items-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={retryAnalyze}
        type="button"
      >
        {busy ? "重新分析中..." : "重新分析素材"}
      </button>
      {message ? (
        <p className="text-sm text-[var(--accent)]">{message}</p>
      ) : null}
    </div>
  );
}
