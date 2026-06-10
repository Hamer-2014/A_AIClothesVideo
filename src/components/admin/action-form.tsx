"use client";

import { useState } from "react";

interface FieldOption {
  label: string;
  value: string;
}

interface ActionField {
  name: string;
  label: string;
  type?: "text" | "number" | "select";
  placeholder?: string;
  defaultValue?: string;
  options?: FieldOption[];
}

interface AdminActionFormProps {
  title: string;
  description: string;
  endpoint: string;
  submitLabel: string;
  fields?: ActionField[];
  fixedPayload?: Record<string, string | number | boolean>;
}

export function AdminActionForm({
  title,
  description,
  endpoint,
  submitLabel,
  fields = [],
  fixedPayload,
}: AdminActionFormProps) {
  const [reason, setReason] = useState("");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      fields.map((field) => [field.name, field.defaultValue ?? ""]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      setMessage("必须填写原因。");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const payload: Record<string, string | number | boolean> = {
      ...(fixedPayload ?? {}),
      reason: reason.trim(),
    };

    for (const field of fields) {
      const rawValue = values[field.name] ?? "";
      if (field.type === "number") {
        payload[field.name] = Number(rawValue);
      } else {
        payload[field.name] = rawValue;
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setMessage(`操作失败: ${body.error ?? response.status}`);
      return;
    }

    setMessage("已提交。刷新页面可查看最新状态。");
    setReason("");
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>

      <div className="mt-4 space-y-3">
        {fields.map((field) => (
          <label className="block" htmlFor={`${title}-${field.name}`} key={field.name}>
            <span className="mb-2 block text-xs font-medium text-[var(--muted)]">
              {field.label}
            </span>
            {field.type === "select" ? (
              <select
                className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                id={`${title}-${field.name}`}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                value={values[field.name] ?? ""}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                id={`${title}-${field.name}`}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                placeholder={field.placeholder}
                type={field.type ?? "text"}
                value={values[field.name] ?? ""}
              />
            )}
          </label>
        ))}

        <label className="block" htmlFor={`${title}-reason`}>
          <span className="mb-2 block text-xs font-medium text-[var(--muted)]">
            原因
          </span>
          <textarea
            className="min-h-24 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
            id={`${title}-reason`}
            onChange={(event) => setReason(event.target.value)}
            placeholder="必须填写操作原因"
            value={reason}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          className="inline-flex h-10 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white disabled:opacity-50"
          disabled={submitting}
          onClick={handleSubmit}
          type="button"
        >
          {submitting ? "提交中..." : submitLabel}
        </button>
        {message ? (
          <p className="text-xs text-[var(--muted)]">{message}</p>
        ) : null}
      </div>
    </section>
  );
}
