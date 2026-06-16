import { sanitizeAuthRedirect } from "@/lib/auth/redirects";

import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{
    next?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const callbackURL = sanitizeAuthRedirect(resolvedSearchParams?.next);
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
            RunwayTools
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            登录工作台
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            使用 Google 或邮箱验证码进入。MVP 不提供密码登录。
          </p>
        </div>

        <LoginForm callbackURL={callbackURL} />
      </section>
    </main>
  );
}
