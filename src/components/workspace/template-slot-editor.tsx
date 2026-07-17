"use client";

export function TemplateSlotEditor({
  slots,
  options,
  onChange,
}: {
  slots: string[];
  options: Array<{ templateId: string; label: string }>;
  onChange: (slots: string[]) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {slots.map((templateId, index) => (
        <label className="grid min-w-0 gap-1" key={index}>
          <span className="text-xs font-medium text-[var(--muted)]">
            镜头 {index + 1}
          </span>
          <select
            aria-label={`镜头 ${index + 1}`}
            className="h-10 min-w-0 rounded-md border border-[var(--line)] bg-white px-2 text-sm outline-none focus:border-[var(--accent)]"
            onChange={(event) => {
              const next = [...slots];
              next[index] = event.target.value;
              onChange(next);
            }}
            value={templateId}
          >
            {options.map((option) => (
              <option key={option.templateId} value={option.templateId}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
