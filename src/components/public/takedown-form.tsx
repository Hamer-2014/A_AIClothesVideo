"use client";

import { useState, type FormEvent } from "react";

export function TakedownForm({
  legalContactEmail,
}: {
  legalContactEmail: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const contentReferences = String(form.get("contentReferences") ?? "")
      .split(/\r?\n/)
      .map((reference) => reference.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/compliance/rights-removal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName: form.get("reporterName"),
          reporterEmail: form.get("reporterEmail"),
          rightsType: form.get("rightsType"),
          contentReferences,
          description: form.get("description"),
          goodFaithConfirmed: form.get("goodFaithConfirmed") === "on",
          accuracyConfirmed: form.get("accuracyConfirmed") === "on",
          companyWebsite: form.get("companyWebsite"),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        reference?: string;
        error?: string;
      } | null;

      if (!response.ok || !body?.reference) {
        setError(
          response.status === 429
            ? "提交过于频繁，请稍后再试。"
            : "暂时无法提交，请检查内容后重试。",
        );
        return;
      }
      setReference(body.reference);
    } catch {
      setError("暂时无法提交，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <section aria-live="polite" className="space-y-4">
        <h2 className="text-lg font-medium text-[var(--ink)]">权利通知已受理</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          公开编号：<strong className="text-[var(--ink)]">{reference}</strong>
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          请保存该编号。我们会先核验材料，不会仅凭提交自动删除内容。
        </p>
        {legalContactEmail ? (
          <p className="text-sm text-[var(--muted)]">
            补充信息可发送至
            <a
              className="ml-1 underline focus-visible:outline-2 focus-visible:outline-offset-2"
              href={`mailto:${legalContactEmail}`}
            >
              {legalContactEmail}
            </a>
          </p>
        ) : null}
      </section>
    );
  }

  const inputClass =
    "mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

  return (
    <form className="space-y-6" onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-[var(--ink)]">
          举报人姓名
          <input
            className={inputClass}
            maxLength={100}
            minLength={2}
            name="reporterName"
            required
          />
        </label>
        <label className="text-sm font-medium text-[var(--ink)]">
          联系邮箱
          <input
            className={inputClass}
            maxLength={254}
            name="reporterEmail"
            required
            type="email"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-[var(--ink)]">
        权利类型
        <select className={inputClass} defaultValue="" name="rightsType" required>
          <option disabled value="">请选择</option>
          <option value="likeness">肖像权</option>
          <option value="copyright">版权</option>
          <option value="trademark">商标权</option>
          <option value="privacy">隐私权</option>
          <option value="other">其他</option>
        </select>
      </label>

      <label className="block text-sm font-medium text-[var(--ink)]">
        涉及内容
        <textarea
          className={inputClass}
          maxLength={2504}
          name="contentReferences"
          placeholder="每行一个任务链接、视频链接或可定位编号，最多 5 项"
          required
          rows={4}
        />
      </label>

      <label className="block text-sm font-medium text-[var(--ink)]">
        权利说明
        <textarea
          className={inputClass}
          maxLength={5000}
          minLength={50}
          name="description"
          required
          rows={8}
        />
      </label>

      <div className="space-y-3 text-sm leading-6 text-[var(--muted)]">
        <label className="flex items-start gap-3">
          <input
            className="mt-1 h-4 w-4 shrink-0"
            name="goodFaithConfirmed"
            required
            type="checkbox"
          />
          <span>诚信声明：我确信所述内容未经授权使用了相关权利。</span>
        </label>
        <label className="flex items-start gap-3">
          <input
            className="mt-1 h-4 w-4 shrink-0"
            name="accuracyConfirmed"
            required
            type="checkbox"
          />
          <span>准确性声明：以上信息真实准确，并同意为核验目的接受联系。</span>
        </label>
      </div>

      <label aria-hidden="true" className="sr-only">
        公司网站
        <input
          autoComplete="off"
          name="companyWebsite"
          tabIndex={-1}
        />
      </label>

      {error ? (
        <p aria-live="polite" className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "正在提交..." : "提交权利通知"}
      </button>
    </form>
  );
}
