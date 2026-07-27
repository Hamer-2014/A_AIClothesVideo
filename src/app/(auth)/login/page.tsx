import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";

import { LogoLockup } from "@/components/brand/logo";
import { sanitizeAuthRedirect } from "@/lib/auth/redirects";
import { SUPPORT_EMAIL } from "@/lib/support-email";

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
    <main className="min-h-screen bg-[var(--surface-raised)] text-[var(--ink)]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.92fr)_minmax(30rem,0.68fr)]">
        <section
          aria-labelledby="login-heading"
          className="flex min-h-screen items-center bg-[var(--surface-raised)] px-6 py-10 sm:px-10 sm:py-14 lg:col-start-2 lg:row-start-1 lg:px-14"
        >
          <div className="mx-auto w-full max-w-lg">
            <div>
              <Link
                aria-label="AI Clothes Video home"
                className="inline-flex"
                href="/"
              >
                <LogoLockup />
              </Link>
              <p className="mt-9 text-sm font-semibold text-[var(--brand)]">
                Secure workspace access
              </p>
              <h1
                className="mt-3 text-3xl font-semibold leading-tight tracking-normal sm:text-4xl"
                id="login-heading"
              >
                Sign in to AI Clothes Video
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--ink)]">
                Turn three authorized clothing images into a promotional product video.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Use Google or a one-time email code. New accounts can configure a free trial before generation.
              </p>
            </div>

            <div className="mt-8">
              <LoginForm callbackURL={callbackURL} />
            </div>

            <nav
              aria-label="Public product links"
              className="mt-8 grid border-y border-[var(--line)] text-sm sm:grid-cols-3"
            >
              <Link
                className="inline-flex min-h-12 items-center justify-between gap-2 border-b border-[var(--line)] py-3 font-medium hover:text-[var(--brand)] sm:border-b-0 sm:pr-4"
                href="/#source-proof"
              >
                View product demo
                <Play aria-hidden="true" size={15} />
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-between gap-2 border-b border-[var(--line)] py-3 font-medium hover:text-[var(--brand)] sm:border-b-0 sm:border-l sm:px-4"
                href="/pricing"
              >
                View pricing
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
              <Link
                className="inline-flex min-h-12 items-center justify-between gap-2 py-3 font-medium hover:text-[var(--brand)] sm:border-l sm:pl-4"
                href="/workspace?mode=trial&preset=minimal_studio"
              >
                Start free trial
                <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </nav>

            <p className="mt-6 text-xs leading-5 text-[var(--muted)]">
              AI Clothes Video is an independent product that uses third-party AI models through its own workflow. It is not affiliated with or endorsed by any model provider. User generation text is screened before processing.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
              <Link className="hover:text-[var(--ink)]" href="/privacy">
                Privacy
              </Link>
              <Link className="hover:text-[var(--ink)]" href="/terms">
                Terms
              </Link>
              <Link className="hover:text-[var(--ink)]" href="/acceptable-use">
                Acceptable Use
              </Link>
              <a className="hover:text-[var(--ink)]" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </section>

        <aside className="relative min-h-[26rem] overflow-hidden bg-black lg:col-start-1 lg:row-start-1 lg:min-h-screen">
          <Image
            alt="Generated red dress product video preview"
            className="object-cover object-center"
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 58vw"
            src="/demo/red-dress-poster.webp"
          />
          <div className="absolute inset-x-0 bottom-0 bg-black/80 px-6 py-7 text-white sm:px-10 lg:px-12 lg:py-10">
            <p className="text-xs font-semibold text-[var(--brand-light)]">
              Real workflow example
            </p>
            <h2 className="mt-3 max-w-lg text-2xl font-semibold leading-tight sm:text-3xl">
              Source images stay the product boundary.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
              The workspace checks front, back, and detail evidence before recommending safe product shots.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
