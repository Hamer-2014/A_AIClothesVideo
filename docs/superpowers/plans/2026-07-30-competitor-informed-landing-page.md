# Competitor-Informed Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the validated competitor decisions to the existing bilingual homepage by fixing conversion-focused navigation, simplifying the controlled workflow, and strengthening the real-SKU evidence chain without inventing products, customers, metrics, or assets.

**Architecture:** Keep the current Next.js App Router homepage, locale resolution, CTA components, analytics events, semantic design tokens, and real red-dress media. Centralize public primary-navigation data so desktop and mobile cannot drift, keep bilingual homepage copy co-located in `src/app/page.tsx`, and extend `SampleVideo` with an optional accessible label for the result video. This is a focused homepage increment, not a new marketing CMS or a workspace rewrite.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4, Lucide React, Vitest 4, Testing Library, in-app browser visual verification.

---

## Scope And Delivery Boundaries

The homepage has one primary job: let an independent clothing seller understand “three images of one garment become one product video,” inspect one real input/output example, and start a trial.

This Goal includes:

- English and Chinese desktop/mobile primary navigation aligned to the conversion path.
- A more scannable four-step controlled workflow in both locales.
- A full-width mobile Hero action stack and a maximum two-column Preset/workflow layout at 768px.
- A stable internal secondary CTA to `#source-proof`.
- One real red-dress SKU across the three source images, poster, and video.
- Anonymous/authenticated CTA and trial-limit behavior protected by tests.
- Mobile, tablet, desktop, keyboard-focus, reduced-motion, and media-rendering verification.

This Goal explicitly excludes:

- New customer logos, testimonials, ROI claims, success-rate claims, or generation-volume claims.
- New case-study walls before at least three authorized, auditable SKU examples exist.
- Visual Preset thumbnails before three genuinely generated Preset outputs exist.
- Homepage upload controls, because login, rights attestation, and the three-image protocol belong in the workspace.
- Team workflows, bulk SKU generation, Brand DNA, store publishing, virtual try-on, and workspace redesign.
- SEO content-cluster implementation. That requires a separate Content Brief with parent page, related pages, CTA, search intent, and unique value.

## File Map

| File | Responsibility | Change |
|---|---|---|
| `docs/superpowers/plans/2026-07-30-competitor-informed-landing-page.md` | Approved implementation contract and execution checklist | Created before execution |
| `src/components/public/public-navigation.ts` | Single bilingual source for public primary-navigation items | Create |
| `src/components/public/public-header.tsx` | Render desktop primary navigation from shared data | Modify |
| `src/components/public/mobile-navigation.tsx` | Render mobile primary navigation from shared data | Modify |
| `src/components/public/public-pages.test.tsx` | Protect English/Chinese desktop and mobile navigation behavior | Modify |
| `src/app/page.tsx` | Keep bilingual homepage content, workflow semantics, responsive content grids, evidence labels, and CTA paths | Modify |
| `src/app/page.test.tsx` | Protect workflow hierarchy, real-SKU evidence, CTA anchors, and user states | Modify |
| `src/components/public/sample-video.tsx` | Expose an optional accessible name for meaningful result video | Modify |
| `src/components/public/sample-video.test.tsx` | Protect accessible labeling, analytics, and reduced-motion behavior | Modify |

No design-token changes are planned. `src/app/globals.css` already supplies the paper-white/graphite/coral system, focus outline, responsive Hero framing, motion tokens, and `prefers-reduced-motion` behavior.

### Task 1: Unify Conversion-Focused Public Navigation

**Files:**
- Create: `src/components/public/public-navigation.ts`
- Modify: `src/components/public/public-header.tsx:1-60`
- Modify: `src/components/public/mobile-navigation.tsx:1-22`
- Test: `src/components/public/public-pages.test.tsx:97-183`

- [x] **Step 1: Write the failing English desktop/mobile navigation test**

Add this test beside the existing Chinese navigation tests in `src/components/public/public-pages.test.tsx`:

```tsx
it("keeps English desktop and mobile navigation on the conversion path", () => {
  render(<PublicHeader language="en" />);

  const desktopNavigation = screen.getByRole("navigation", {
    name: "Primary navigation",
  });
  expect(
    within(desktopNavigation).getByRole("link", {
      name: "Three-image workflow",
    }),
  ).toHaveAttribute("href", "/three-images-to-clothing-video");
  expect(within(desktopNavigation).getByRole("link", { name: "Pricing" }))
    .toHaveAttribute("href", "/pricing");
  expect(within(desktopNavigation).getByRole("link", { name: "FAQ" }))
    .toHaveAttribute("href", "/faq");
  expect(within(desktopNavigation).queryByRole("link", { name: "Privacy" }))
    .not.toBeInTheDocument();
  expect(within(desktopNavigation).queryByRole("link", { name: "Terms" }))
    .not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  const mobileNavigation = screen.getByRole("navigation", {
    name: "Mobile primary navigation",
  });
  expect(
    within(mobileNavigation).getByRole("link", {
      name: "Three-image workflow",
    }),
  ).toHaveAttribute("href", "/three-images-to-clothing-video");
  expect(within(mobileNavigation).getByRole("link", { name: "Pricing" }))
    .toHaveAttribute("href", "/pricing");
  expect(within(mobileNavigation).getByRole("link", { name: "FAQ" }))
    .toHaveAttribute("href", "/faq");
});
```

- [x] **Step 2: Run RED**

Run:

```powershell
pnpm exec vitest run src/components/public/public-pages.test.tsx -t "keeps English desktop and mobile navigation on the conversion path"
```

Expected: FAIL because the English primary navigation still contains `Privacy` and `Terms`, and has no `Three-image workflow` or `FAQ` links.

- [x] **Step 3: Create the shared navigation definition**

Create `src/components/public/public-navigation.ts`:

```ts
import type { SiteLocale } from "@/lib/i18n/config";

export interface PublicNavigationItem {
  href: string;
  label: string;
}

export const publicNavigationItems = {
  en: [
    {
      href: "/three-images-to-clothing-video",
      label: "Three-image workflow",
    },
    { href: "/pricing", label: "Pricing" },
    { href: "/faq", label: "FAQ" },
  ],
  "zh-CN": [
    { href: "/three-images-to-clothing-video", label: "三图生成" },
    { href: "/pricing", label: "价格" },
    { href: "/faq", label: "常见问题" },
  ],
} satisfies Record<SiteLocale, readonly PublicNavigationItem[]>;
```

- [x] **Step 4: Render the shared definition in desktop and mobile navigation**

In `src/components/public/public-header.tsx`, add:

```ts
import { publicNavigationItems } from "./public-navigation";
```

Replace the locale-specific desktop link branches with:

```tsx
{publicNavigationItems[language].map((item) => (
  <Link
    className="text-[var(--muted)] hover:text-[var(--ink)]"
    href={localizeHref(item.href, language)}
    key={item.href}
  >
    {item.label}
  </Link>
))}
```

In `src/components/public/mobile-navigation.tsx`, import the same definition and delete the local `navigationItems` constant:

```ts
import { publicNavigationItems } from "./public-navigation";
```

Use it in the existing map:

```tsx
{publicNavigationItems[language].map((item) => (
  <Link
    className="flex min-h-11 items-center border-b border-[var(--line)] px-3 text-sm font-medium text-[var(--ink)] last:border-b-0 hover:bg-[var(--surface-subtle)]"
    href={localizeHref(item.href, language)}
    key={item.href}
    onClick={() => setIsOpen(false)}
  >
    {item.label}
  </Link>
))}
```

- [x] **Step 5: Run GREEN and the full shared-navigation file**

Run:

```powershell
pnpm exec vitest run src/components/public/public-pages.test.tsx
```

Expected: all tests in `public-pages.test.tsx` PASS, including the existing Chinese links, Escape-to-close behavior, focus restoration, and CTA tracking.

- [x] **Step 6: Commit Task 1**

```powershell
git add src/components/public/public-navigation.ts src/components/public/public-header.tsx src/components/public/mobile-navigation.tsx src/components/public/public-pages.test.tsx
git commit -m "fix: align public navigation with conversion flow"
```

### Task 2: Replace Defensive Stability Copy With A Scannable Responsive Workflow

**Files:**
- Modify: `src/app/page.tsx:36-47,98-109,217-228`
- Test: `src/app/page.test.tsx:1-85`

- [x] **Step 1: Write failing bilingual workflow tests**

Change the Testing Library import in `src/app/page.test.tsx` to:

```ts
import { cleanup, render, screen, within } from "@testing-library/react";
```

Add these assertions to the existing English homepage test:

```tsx
const workflowTitle = screen.getByRole("heading", {
  level: 2,
  name: "A controlled workflow from upload to delivery",
});
const workflowSection = workflowTitle.closest("section");
expect(workflowSection).not.toBeNull();
expect(within(workflowSection as HTMLElement).getAllByRole("listitem"))
  .toHaveLength(4);
expect(
  within(workflowSection as HTMLElement).getByRole("heading", {
    level: 3,
    name: "Map image evidence",
  }),
).toBeInTheDocument();
expect(
  within(workflowSection as HTMLElement).getByRole("heading", {
    level: 3,
    name: "Match eligible shots",
  }),
).toBeInTheDocument();
```

Add these assertions to the existing Chinese homepage test:

```tsx
expect(
  screen.getByRole("heading", {
    level: 2,
    name: "从上传到交付，每一步都有明确边界",
  }),
).toBeInTheDocument();
expect(screen.getByRole("heading", { level: 3, name: "读取素材依据" }))
  .toBeInTheDocument();
expect(screen.getByRole("heading", { level: 3, name: "匹配可用镜头" }))
  .toBeInTheDocument();
```

Add this tablet-grid assertion to the English homepage test:

```tsx
const presetTitle = screen.getByRole("heading", {
  level: 2,
  name: "Tell the system where the video will be used",
});
const presetSection = presetTitle.closest("section");
expect(presetSection).not.toBeNull();
expect(within(presetSection as HTMLElement).getByRole("list"))
  .toHaveClass("md:grid-cols-2", "lg:grid-cols-3");
```

- [x] **Step 2: Run RED**

Run:

```powershell
pnpm exec vitest run src/app/page.test.tsx -t "uses English by default|keeps the Chinese homepage"
```

Expected: FAIL because the current section headings are `AI does not get free rein over garment details` and `不让 AI 自由发挥服装细节`.

- [x] **Step 3: Replace only the controlled-workflow copy**

Replace `homeCopy.en.control` in `src/app/page.tsx` with:

```ts
control: {
  kicker: "02 / A controlled path to delivery",
  title: "A controlled workflow from upload to delivery",
  body: "The system checks the three image roles, narrows the shot list to what the source images support, and reviews generated frames before delivery.",
  link: "See how each image affects shot selection",
  steps: [
    ["01", "Confirm one garment", "Confirm that all three images show the same garment. You still verify that the detail image belongs to that garment."],
    ["02", "Map image evidence", "Use front, back, side, and detail evidence to define which views have a real source."],
    ["03", "Match eligible shots", "Remove unsupported shots first, then let the selected style preset rank the remaining options."],
    ["04", "Review before delivery", "Check generated frames and record task status before preview and download become available."],
  ],
},
```

Replace `homeCopy["zh-CN"].control` with:

```ts
control: {
  kicker: "02 / 从素材到可用镜头",
  title: "从上传到交付，每一步都有明确边界",
  body: "系统先检查三张图的素材角色，再把镜头收窄到真实素材支持的范围，并在交付前检查生成画面。",
  link: "了解三张图如何影响镜头选择",
  steps: [
    ["01", "确认同一件服装", "确认三张素材来自同一件服装；细节图是否属于该服装仍需由你核对。"],
    ["02", "读取素材依据", "根据正面、背面、侧面与细节证据，明确哪些展示角度有真实来源。"],
    ["03", "匹配可用镜头", "先移除素材不支持的镜头，再由所选风格预设排序剩余选项。"],
    ["04", "交付前检查", "检查生成画面并记录任务状态，通过后再提供预览与下载。"],
  ],
},
```

Give the dark workflow section an explicit accessible name:

```tsx
<section
  aria-labelledby="controlled-workflow-title"
  className="bg-[var(--ink)] text-white"
>
```

Add the matching ID to the section heading:

```tsx
<h2
  className="text-3xl font-semibold leading-tight sm:text-5xl"
  id="controlled-workflow-title"
>
  {copy.control.title}
</h2>
```

Replace the Hero action row so both actions are full-width at 390px and return to content width from `sm` upward:

```tsx
<div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
  <div className="w-full sm:w-auto [&>a]:w-full">
    {primaryCta("hero")}
  </div>
  <a
    className="inline-flex min-h-11 w-full items-center justify-center border border-white/50 px-5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 sm:w-auto"
    href="#source-proof"
  >
    {copy.hero.secondary}
  </a>
</div>
```

Give the Preset section and its list explicit semantics, and delay the three-column layout until `lg`:

```tsx
<section
  aria-labelledby="preset-title"
  className="bg-[var(--background)]"
>
  <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
    <p className="section-kicker">{copy.preset.kicker}</p>
    <h2 className="section-title max-w-3xl" id="preset-title">
      {copy.preset.title}
    </h2>
    <ul className="mt-12 grid gap-px border-y border-[var(--line-strong)] bg-[var(--line-strong)] md:grid-cols-2 lg:grid-cols-3">
      {copy.preset.items.map(([name, description, boundary]) => (
        <li
          className="bg-[var(--background)] px-0 py-7 sm:px-7 md:last:col-span-2 lg:last:col-span-1"
          key={name}
        >
          <h3 className="text-xl font-semibold">{name}</h3>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
          <p className="mt-7 border-l-2 border-[var(--brand)] pl-3 text-xs leading-5 text-[var(--muted)]">
            {boundary}
          </p>
        </li>
      ))}
    </ul>
    <p className="mt-6 text-sm leading-6 text-[var(--muted)]">
      {copy.preset.boundary}
    </p>
  </div>
</section>
```

- [x] **Step 4: Run GREEN**

Run:

```powershell
pnpm exec vitest run src/app/page.test.tsx
```

Expected: 4 homepage tests PASS in both locales and both authentication states.

- [x] **Step 5: Commit Task 2**

```powershell
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: clarify homepage generation workflow"
```

### Task 3: Lock The Real-SKU Evidence And Secondary CTA Contract

**Files:**
- Modify: `src/components/public/sample-video.tsx:7-70`
- Modify: `src/components/public/sample-video.test.tsx:16-51`
- Modify: `src/app/page.tsx:18-35,80-97,189-216`
- Modify: `src/app/page.test.tsx:41-142`

- [x] **Step 1: Write the failing accessible-result-video test**

Add to `src/components/public/sample-video.test.tsx`:

```tsx
it("exposes an accessible label for a meaningful result video", () => {
  render(
    <SampleVideo
      ariaLabel="Generated red dress product video"
      controls
      sourcePage="homepage"
    />,
  );

  expect(screen.getByLabelText("Generated red dress product video"))
    .toHaveAttribute("src", "/demo/red-dress-video.mp4");
});
```

- [x] **Step 2: Extend the homepage evidence assertions**

Add these assertions to the English homepage test in `src/app/page.test.tsx`:

```tsx
expect(
  screen.getByRole("link", { name: "View the real three-image sample" }),
).toHaveAttribute("href", "#source-proof");
expect(screen.getByLabelText("Generated red dress product video"))
  .toHaveAttribute("src", "/demo/red-dress-video.mp4");
expect(screen.getByLabelText("Generated red dress product video"))
  .toHaveAttribute("poster", "/demo/red-dress-poster.webp");
```

Add this assertion to the Chinese homepage test:

```tsx
expect(screen.getByRole("link", { name: "查看真实三图样例" }))
  .toHaveAttribute("href", "#source-proof");
expect(screen.getByLabelText("由三张红色连衣裙素材生成的商品视频"))
  .toHaveAttribute("src", "/demo/red-dress-video.mp4");
```

Add this anonymous-state assertion to `shows anonymous trial actions to visitors`:

```tsx
expect(
  screen.getByText(
    "8 seconds · low resolution · no audio · watermarked · low-risk shots only",
  ),
).toBeInTheDocument();
```

Add this authenticated-state assertion to `shows signed-in workspace actions instead of anonymous trial actions`:

```tsx
expect(
  screen.queryByText(
    "8 seconds · low resolution · no audio · watermarked · low-risk shots only",
  ),
).not.toBeInTheDocument();
expect(
  screen.getByRole("link", { name: "View the real three-image sample" }),
).toHaveAttribute("href", "#source-proof");
```

- [x] **Step 3: Run RED**

Run:

```powershell
pnpm exec vitest run src/components/public/sample-video.test.tsx src/app/page.test.tsx
```

Expected: FAIL because `SampleVideo` does not yet accept or render an accessible label. Existing source-image, CTA, trial-note, and authentication assertions should already pass and act as regression coverage.

- [x] **Step 4: Add the optional accessible label**

Update the `SampleVideo` signature in `src/components/public/sample-video.tsx`:

```tsx
export function SampleVideo({
  ariaLabel,
  autoPlay = false,
  className,
  controls = false,
  language = "en",
  sourcePage,
  testId,
}: {
  ariaLabel?: string;
  autoPlay?: boolean;
  className?: string;
  controls?: boolean;
  language?: SiteLocale;
  sourcePage: string;
  testId?: string;
}) {
```

Add the label to the existing `<video>` element:

```tsx
<video
  aria-label={ariaLabel}
  autoPlay={autoPlay}
```

- [x] **Step 5: Name the result video in both locales**

Add to `homeCopy.en.evidence`:

```ts
videoLabel: "Generated red dress product video",
```

Add to `homeCopy["zh-CN"].evidence`:

```ts
videoLabel: "由三张红色连衣裙素材生成的商品视频",
```

Pass the label only to the controlled result video in `#source-proof`:

```tsx
<SampleVideo
  ariaLabel={copy.evidence.videoLabel}
  className="size-full object-cover"
  controls
  language={locale}
  sourcePage="homepage"
/>
```

- [x] **Step 6: Run GREEN**

Run:

```powershell
pnpm exec vitest run src/components/public/sample-video.test.tsx src/app/page.test.tsx
```

Expected: all tests in both files PASS; video engagement tracking remains unchanged because only controlled playback receives handlers.

- [x] **Step 7: Commit Task 3**

```powershell
git add src/components/public/sample-video.tsx src/components/public/sample-video.test.tsx src/app/page.tsx src/app/page.test.tsx
git commit -m "test: protect homepage evidence and CTA contract"
```

### Task 4: Verify Reduced Motion, Responsive Layout, And Accessibility

**Files:**
- Test: `src/components/public/sample-video.test.tsx`
- Verify: `src/app/globals.css:65-187`
- Verify: `src/app/page.tsx`
- Verify: `src/components/public/public-header.tsx`
- Verify: `src/components/public/mobile-navigation.tsx`

- [x] **Step 1: Add reduced-motion regression coverage**

Update the Vitest import in `src/components/public/sample-video.test.tsx`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

Add cleanup for restored browser mocks:

```ts
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
```

Add the regression test:

```tsx
it("pauses autoplay media when reduced motion is requested", () => {
  const pause = vi
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => undefined);
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: true }),
  );

  render(<SampleVideo autoPlay sourcePage="homepage" testId="hero" />);

  expect(pause).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2: Run the reduced-motion regression test**

Run:

```powershell
pnpm exec vitest run src/components/public/sample-video.test.tsx -t "pauses autoplay media when reduced motion is requested"
```

Expected: PASS against the existing `matchMedia("(prefers-reduced-motion: reduce)")` effect. A failure means Task 3 altered existing motion behavior and must be corrected before browser QA.

- [x] **Step 3: Run focused code gates**

Run:

```powershell
pnpm exec vitest run src/components/public/public-pages.test.tsx src/components/public/sample-video.test.tsx src/app/page.test.tsx
pnpm exec eslint src/components/public/public-navigation.ts src/components/public/public-header.tsx src/components/public/mobile-navigation.tsx src/components/public/public-pages.test.tsx src/components/public/sample-video.tsx src/components/public/sample-video.test.tsx src/app/page.tsx src/app/page.test.tsx
pnpm run typecheck
```

Expected: all focused tests PASS, ESLint exits 0, and TypeScript exits 0.

- [x] **Step 4: Start the development server**

Run on an available port:

```powershell
pnpm exec next dev --webpack --port 3000
```

Expected: Next.js reports the local URL and serves `/` and `/zh` without a runtime error. If port 3000 is occupied, use `pnpm exec next dev --webpack --port 3001` and keep that URL for all checks below.

- [x] **Step 5: Verify both locales at three viewport classes**

Use the in-app browser to inspect `/` and `/zh` at:

| Viewport | Required observations |
|---|---|
| 390 x 844 | No horizontal overflow; H1 and CTA text wrap without clipping; Hero shows a hint of `#source-proof`; mobile menu contains workflow, pricing, and FAQ; tap targets are at least 44px. |
| 768 x 1024 | Evidence images remain a stable three-column strip; workflow becomes two columns without border collisions; no text/media overlap. |
| 1440 x 900 | Hero video is nonblank and framed around the garment; copy remains readable over the shade; source evidence, result video, Presets, and delivery specs retain the editorial hierarchy. |

At every viewport verify:

- `View the real three-image sample` / `查看真实三图样例` scrolls to `#source-proof` and never starts authentication.
- The source images, poster, Hero video, and controlled result video all show the red-dress SKU.
- English and Chinese pages do not mix visible languages.
- Keyboard Tab shows the shared focus outline; Escape closes the mobile navigation and restores focus to its trigger.
- With reduced motion enabled, Hero entrance animation is effectively removed and autoplay video pauses.
- There are no console errors, failed local media requests, or inaccessible unlabeled result videos.

- [x] **Step 6: Run the frontend design audit**

Run:

```powershell
python "$env:USERPROFILE/.codex/skills/frontend-design/scripts/audit_frontend_principles.py" .
```

Expected: no `FAIL`. Manually review warnings against `docs/COMPETITOR_LANDING_DECISIONS.md`; the homepage must retain one primary task, no card farm, and no unsupported claims.

- [x] **Step 7: Commit Task 4 test coverage**

```powershell
git add src/components/public/sample-video.test.tsx
git commit -m "test: cover reduced-motion sample playback"
```

### Task 5: Run The Single Final Stage Gate

**Files:**
- Verify only; no planned source changes.

- [x] **Step 1: Inspect the final change set**

Run:

```powershell
git status --short
git diff --stat HEAD~4..HEAD
git diff --check HEAD~4..HEAD
git diff HEAD~4..HEAD -- src/components/public src/app/page.tsx src/app/page.test.tsx
```

Expected: only the files listed in the File Map changed; `git diff --check` produces no output; no placeholder copy, invented data, unrelated refactor, or generated-file churn appears.

- [x] **Step 2: Run the full suite once**

Run:

```powershell
pnpm exec vitest run --maxWorkers=2
pnpm run lint
pnpm run typecheck
```

Expected: the full Vitest suite passes, ESLint exits 0, and TypeScript exits 0. Report actual test file and test counts from this run; do not reuse the earlier 67/67 i18n count or the separate 68/68 workspace count.

- [x] **Step 3: Record acceptance evidence**

The implementation handoff must include:

- The four task commit hashes.
- Focused-test results and the single final full-suite result.
- ESLint, typecheck, `git diff --check`, and frontend-audit results.
- Desktop/mobile screenshot locations or browser capture references for `/` and `/zh`.
- Any remaining manual-review warning, without presenting it as a passing automated assertion.

## Execution Record

Closed on 2026-07-30 against `main` at `4956e49`.

| Task | Commit | Evidence |
|---|---|---|
| Plan | `4ca9cc5` | Competitor-informed scope, TDD steps, and acceptance matrix recorded. |
| Public navigation | `3e59d1b` | Shared desktop/mobile conversion navigation implemented and covered by focused tests. |
| Homepage workflow | `66113a8` | Bilingual controlled workflow, responsive preset grid, and mobile CTA layout implemented. |
| SKU evidence contract | `b43e23e` | Source-image paths, accessible result-video labels, secondary CTA, and trial-note behavior locked by tests. |
| Reduced motion | `4956e49` | Autoplay media pauses when reduced motion is requested. |

Final verification evidence:

- Focused homepage/public suite passed before the stage gate.
- Full Vitest suite: 210/210 files and 1046/1046 tests passed in 274.14 seconds.
- ESLint, TypeScript, frontend audit, and `git diff --check origin/main..HEAD` passed.
- `/` and `/zh` were inspected at 390 x 844, 768 x 1024, and 1440 x 900 with no blocking layout, media, language, keyboard, or console issue.
- The implementation was merged and pushed; `main` and `origin/main` both pointed to `4956e49` at closure.
- Browser inspection was completed in the prior session, but no durable screenshot files were committed. Persistent captures will be added by the independent multi-SKU/Preset-preview goal and must not be inferred from this record.

## Acceptance Matrix

| Requirement | Automated evidence | Browser/manual evidence |
|---|---|---|
| English primary navigation uses workflow, pricing, FAQ | `public-pages.test.tsx` | Desktop and mobile menu checks |
| Privacy and Terms remain reference links, not primary navigation | Primary-navigation scoped assertions; existing Footer tests | Footer inspection |
| Secondary CTA scrolls to a real example | `page.test.tsx` anchor assertions | Anchor-scroll check |
| One real SKU supplies all evidence | Source paths and accessible result-video assertions | Media inspection at all viewports |
| Trial restrictions stay explicit for anonymous users | `page.test.tsx` | Hero copy check |
| Authenticated visitors receive workspace CTAs | Existing `page.test.tsx` assertions | Signed-in smoke check when a session is available |
| Workflow is scannable and still enforces source boundaries | Four-item scoped assertions in both locales | Editorial hierarchy check |
| Tablet content grids do not compress into narrow three/four-column copy | Preset list class assertion | 768 x 1024 layout check |
| Presets do not bypass source-image limits | Existing boundary copy remains unchanged | Copy check |
| Reduced motion pauses autoplay and suppresses long animation | `sample-video.test.tsx`; existing CSS media query | OS/browser reduced-motion check |
| No layout overlap or horizontal overflow | Not asserted in jsdom | 390/768/1440 browser checks |

## Subsequent Independent Goals

These are the complete post-homepage roadmap, but each must be opened and accepted as its own Goal so that assets, metrics, tests, and rollout decisions stay auditable.

| Order | Independent Goal | Entry gate | Deliverable | Risk / estimate |
|---:|---|---|---|---|
| 1 | Multi-SKU case-study system | At least 3 different garment categories; source images and generated videos are authorized; generation settings and caveats are recorded | Case index, case detail template, homepage case entry, media metadata, localized copy | Medium, 3-5 dev days plus asset preparation |
| 2 | Real Style Preset previews | One controlled SKU has genuinely generated outputs for Minimal studio, Product image motion, and Social atmosphere | Three comparable previews with identical source context and truthful boundary notes | Medium, 2-3 dev days plus generation/QA cost |
| 3 | Evidence-backed social proof | Auditable customer permission and source data exist | Approved logos/testimonials or measured funnel metrics with dates, sample size, and methodology | Medium, 2-4 dev days; blocked until evidence exists |
| 4 | Landing conversion measurement | Stable traffic volume and privacy-safe event definitions exist | Funnel dashboard for landing view, sample play, CTA click, login completion, upload completion, and first deliverable | Medium, 3-5 dev days; do not start A/B tests before baseline volume |
| 5 | SEO internal-link content cluster | Parent page, related pages, CTA, unique value, and keyword/search-intent evidence are approved in a Content Brief | Pillar/support pages, anchor map, sitemap updates, and internal-link acceptance tests | Medium, 4-7 dev days; must use `seo-link-neilian` |
| 6 | Workspace information-architecture refinement | Homepage funnel data shows users reach upload but stall in the workspace; workspace states and errors are inventoried | One primary upload/generation surface, explicit state model, progressive disclosure, responsive QA | Medium-high, 5-8 dev days; separate TDD plan and consolidated review |

Do not schedule team collaboration, bulk SKU processing, automatic store/social publishing, Brand DNA, or virtual try-on from competitor parity alone. Those are new product bets with backend, permission, billing, and support consequences, not homepage features.

## Execution Order And Stop Conditions

Execute Tasks 1-4 with focused RED/GREEN cycles and one commit per task. Run Task 5 exactly once after all focused checks pass. Stop and report rather than expanding the Goal when any of the following occurs:

- A requested design needs a new unapproved image, video, testimonial, logo, or metric.
- The implementation requires changing authentication, rights attestation, billing, generation, or storage behavior.
- The real red-dress assets do not match each other on visual inspection.
- The same defect fails after two repair attempts.
- The final work no longer fits the File Map or the acceptance matrix above.
