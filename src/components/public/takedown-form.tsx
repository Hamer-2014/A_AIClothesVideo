"use client";

import { useState, type FormEvent } from "react";

import type { SiteLocale } from "@/lib/i18n/config";

const formCopy = {
  en: {
    rate: "Too many submissions. Please try again later.", submitError: "We could not submit your notice. Check the information and try again.", later: "We could not submit your notice. Please try again later.",
    received: "Rights notice received", reference: "Public reference:", save: "Save this reference. We review the materials before taking action; submitting a notice does not automatically remove content.", additional: "Send additional information to",
    name: "Your name", email: "Email address", type: "Type of right", select: "Select a right", likeness: "Likeness", copyright: "Copyright", trademark: "Trademark", privacy: "Privacy", other: "Other",
    references: "Content references", referencesPlaceholder: "One job URL, video URL, or locatable reference per line, up to 5 items", description: "Description of your rights",
    goodFaith: "I have a good-faith belief that the reported content uses these rights without authorization.", accuracy: "I confirm that this information is accurate and complete, and I agree to be contacted for verification.", company: "Company website", submitting: "Submitting...", submit: "Submit rights notice",
  },
  "zh-CN": {
    rate: "提交过于频繁，请稍后重试。", submitError: "无法提交通知，请检查信息后重试。", later: "无法提交通知，请稍后重试。",
    received: "已收到权利通知", reference: "公开编号：", save: "请保存此编号。我们会先审核素材再采取措施；提交通知不会自动删除内容。", additional: "补充信息请发送至",
    name: "姓名", email: "邮箱地址", type: "权利类型", select: "选择权利类型", likeness: "肖像权", copyright: "版权", trademark: "商标权", privacy: "隐私权", other: "其他",
    references: "内容引用", referencesPlaceholder: "每行填写一个任务 URL、视频 URL 或可定位引用，最多 5 项", description: "权利说明",
    goodFaith: "我善意相信被举报内容未经授权使用了上述权利。", accuracy: "我确认信息准确完整，并同意接受联系以核实情况。", company: "公司网站", submitting: "正在提交...", submit: "提交权利通知",
  },
} as const;

export function TakedownForm({
  language = "en",
  legalContactEmail,
}: {
  language?: SiteLocale;
  legalContactEmail: string;
}) {
  const copy = formCopy[language];
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
            ? copy.rate
            : copy.submitError,
        );
        return;
      }
      setReference(body.reference);
    } catch {
      setError(copy.later);
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <section aria-live="polite" className="space-y-4">
        <h2 className="text-lg font-medium text-[var(--ink)]">{copy.received}</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          {copy.reference} <strong className="text-[var(--ink)]">{reference}</strong>
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          {copy.save}
        </p>
        {legalContactEmail ? (
          <p className="text-sm text-[var(--muted)]">
            {copy.additional}
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
          {copy.name}
          <input
            className={inputClass}
            maxLength={100}
            minLength={2}
            name="reporterName"
            required
          />
        </label>
        <label className="text-sm font-medium text-[var(--ink)]">
          {copy.email}
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
        {copy.type}
        <select className={inputClass} defaultValue="" name="rightsType" required>
          <option disabled value="">{copy.select}</option>
          <option value="likeness">{copy.likeness}</option>
          <option value="copyright">{copy.copyright}</option>
          <option value="trademark">{copy.trademark}</option>
          <option value="privacy">{copy.privacy}</option>
          <option value="other">{copy.other}</option>
        </select>
      </label>

      <label className="block text-sm font-medium text-[var(--ink)]">
        {copy.references}
        <textarea
          className={inputClass}
          maxLength={2504}
          name="contentReferences"
          placeholder={copy.referencesPlaceholder}
          required
          rows={4}
        />
      </label>

      <label className="block text-sm font-medium text-[var(--ink)]">
        {copy.description}
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
          <span>{copy.goodFaith}</span>
        </label>
        <label className="flex items-start gap-3">
          <input
            className="mt-1 h-4 w-4 shrink-0"
            name="accuracyConfirmed"
            required
            type="checkbox"
          />
          <span>{copy.accuracy}</span>
        </label>
      </div>

      <label aria-hidden="true" className="sr-only">
        {copy.company}
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
        {submitting ? copy.submitting : copy.submit}
      </button>
    </form>
  );
}
