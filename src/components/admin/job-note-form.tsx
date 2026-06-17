"use client";

import { useState } from "react";

export function JobNoteForm({ endpoint }: { endpoint: string }) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      setMessage("备注不能为空。");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: normalizedNote }),
    });
    const body = await response.json().catch(() => ({}));

    setSubmitting(false);
    if (!response.ok) {
      setMessage(`备注失败: ${body.error ?? response.status}`);
      return;
    }

    setNote("");
    setMessage("备注已写入。刷新页面可查看最新备注。");
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <textarea
        className="min-h-20 rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
        onChange={(event) => setNote(event.target.value)}
        placeholder="记录处理判断、账务核对结果或后续动作"
        required
        value={note}
      />
      <div className="flex flex-col items-start gap-2">
        <button
          className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--ink)] bg-[var(--ink)] px-4 text-sm font-medium text-white disabled:opacity-50"
          disabled={submitting}
          onClick={handleSubmit}
          type="button"
        >
          {submitting ? "提交中..." : "添加备注"}
        </button>
        {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
      </div>
    </div>
  );
}
