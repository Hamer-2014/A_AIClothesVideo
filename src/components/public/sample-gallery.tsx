export interface PublicSampleItem {
  title: string;
  description: string;
  mediaLabel: string;
}

export function SampleGallery({
  samples = [],
}: {
  samples?: PublicSampleItem[];
}) {
  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6">
        <p className="text-sm font-medium text-[var(--ink)]">样例准备中</p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          我们只展示真实生成过的服装样例；当前暂无可公开案例。
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {samples.map((sample) => (
        <article
          className="rounded-lg border border-[var(--line)] bg-white p-4"
          key={sample.title}
        >
          <div className="flex aspect-[9/16] items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-center text-sm font-medium text-[var(--muted)]">
            {sample.mediaLabel}
          </div>
          <h3 className="mt-4 text-sm font-medium">{sample.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {sample.description}
          </p>
        </article>
      ))}
    </div>
  );
}
