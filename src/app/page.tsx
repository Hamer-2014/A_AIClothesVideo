import { Activity, CheckCircle2, LockKeyhole, Server } from "lucide-react";

const foundationItems = [
  {
    icon: Server,
    label: "应用骨架",
    value: "Next.js App Router",
  },
  {
    icon: Activity,
    label: "健康检查",
    value: "GET /api/health",
  },
  {
    icon: LockKeyhole,
    label: "密钥策略",
    value: "仅 env 声明，不提交真实密钥",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-6 border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">
              RunwayTools MVP
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-normal">
              服装商品图生成宣传短视频工具站
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-[var(--muted)] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            Foundation
          </div>
        </header>

        <div className="grid gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
              Development Status
            </p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
              基础工程已进入开发，真实生成链路尚未开放。
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              当前阶段只建立可部署应用骨架、环境变量边界和健康检查。
              Creem、R2、Neon、DeepSeek、EvoLink 与 Cloud Run 会在后续里程碑真实接入，不提供假成功结果。
            </p>
          </div>

          <div className="border-l border-[var(--line)] pl-0 lg:pl-8">
            <div className="space-y-4">
              {foundationItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    className="flex items-start gap-4 border-b border-[var(--line)] pb-4 last:border-0"
                    key={item.label}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-[var(--accent)] shadow-sm">
                      <Icon aria-hidden="true" size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {item.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[var(--line)] pt-5 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>部署验收入口：/api/health</span>
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" size={16} />
            按 DEVELOPMENT_SPEC 第 1-2 章推进
          </span>
        </footer>
      </section>
    </main>
  );
}
