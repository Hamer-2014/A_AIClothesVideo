# Bilingual SEO Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an English-first, Chinese-localized three-article guide cluster with working discovery links, parent-page links, conversion paths, metadata, and sitemap entries.

**Architecture:** Store the three guide definitions and both language versions in one typed catalog, render them through shared index/article components, and expose them through dynamic App Router pages at `/guides/*` and `/zh/guides/*`. Keep `/three-images-to-clothing-video` as the topic parent, add `/guides` to global navigation and footer, and register every localized URL in the existing public-page sitemap catalog.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Workspace note:** Execute in the current workspace because the sitemap/robots/SEO files and the initial content pack are untracked dependencies already present here; moving to a clean worktree would omit them.

---

## File Map

- Create `src/lib/guides/catalog.ts`: typed bilingual article metadata, content blocks, relationships, and path helpers.
- Create `src/lib/guides/catalog.test.ts`: catalog completeness and non-orphan link invariants.
- Create `src/components/public/guide-pages.tsx`: shared guide index and article presentation using existing design tokens.
- Create `src/app/guides/page.tsx`: English-first guide index with localized rendering and metadata.
- Create `src/app/guides/[slug]/page.tsx`: statically generated guide article route with localized metadata.
- Create `src/app/guides/guides.test.tsx`: English/Chinese index and article behavior tests.
- Create `src/app/zh/guides/page.tsx`: Chinese route export.
- Create `src/app/zh/guides/[slug]/page.tsx`: Chinese article route export.
- Modify `src/components/public/public-navigation.ts`: add the global Guides/指南 entry.
- Modify `src/components/layout/site-footer-content.tsx`: add a footer Guides/实用指南 entry.
- Modify `src/components/public/public-pages.test.tsx`: verify desktop/mobile/header/footer guide discovery.
- Modify `src/app/three-images-to-clothing-video/page.tsx`: add the downward links from the topic parent.
- Modify `src/app/three-images-to-clothing-video/page.test.tsx`: verify all three localized child links.
- Modify `src/lib/seo/site.ts`: add the guide index and six localized article URLs.
- Modify `src/app/sitemap.test.ts`: require every guide URL and language alternate.
- Modify `src/app/zh/route-exports.test.ts`: require Chinese guide metadata exports.
- Modify `docs/seo/INTERNAL_LINK_CONTENT_PACK_2026-08-03.md`: record the English-first URL pairs and implementation status.

### Task 1: Lock catalog behavior with failing tests

- [ ] **Step 1: Create the catalog test before production code**

```ts
import { describe, expect, it } from "vitest";
import { guideArticles, guideSlugs } from "./catalog";

describe("guide catalog", () => {
  it("publishes three complete English-first bilingual guides", () => {
    expect(guideSlugs).toHaveLength(3);
    for (const slug of guideSlugs) {
      expect(guideArticles[slug].en.title).toBeTruthy();
      expect(guideArticles[slug]["zh-CN"].title).toBeTruthy();
    }
  });

  it("gives every article a parent, conversion target, and two peers", () => {
    for (const slug of guideSlugs) {
      expect(guideArticles[slug].parentHref).toBe("/three-images-to-clothing-video");
      expect(guideArticles[slug].ctaHref).toContain("/workspace?");
      expect(guideArticles[slug].relatedSlugs).toHaveLength(2);
    }
  });
});
```

- [ ] **Step 2: Run `pnpm test src/lib/guides/catalog.test.ts` and verify RED**

Expected: FAIL because `src/lib/guides/catalog.ts` does not exist.

- [ ] **Step 3: Implement the typed catalog with all English and Chinese copy**

The catalog must define the exact slugs `clothing-video-without-back-image`, `choose-clothing-video-length`, and `why-ai-clothing-videos-deform`; include unique metadata, direct answers, substantive sections, natural contextual links, related peers, parent link, and trial CTA for both locales.

- [ ] **Step 4: Re-run the focused catalog test and verify GREEN**

Run: `pnpm test src/lib/guides/catalog.test.ts`

Expected: 2 tests pass.

### Task 2: Render index and article routes through TDD

- [ ] **Step 1: Create failing route tests**

Test English and Chinese guide index headings, three article links, English and Chinese article H1s, parent links, two related links, trial CTA, and canonical/hreflang metadata.

- [ ] **Step 2: Run `pnpm test src/app/guides/guides.test.tsx` and verify RED**

Expected: FAIL because guide routes/components do not exist.

- [ ] **Step 3: Implement shared guide pages and App Router routes**

Use existing semantic tokens and real traceable demo images. Keep the index as an unframed editorial list and the article as a narrow reading column with a single prominent trial CTA. Export `generateStaticParams` and localized `generateMetadata`; use `notFound()` for unknown slugs.

- [ ] **Step 4: Add Chinese route re-exports and metadata coverage**

The `/zh/guides` and `/zh/guides/[slug]` modules must re-export the English route implementation and metadata/static-param functions so locale middleware remains the single localization mechanism.

- [ ] **Step 5: Re-run route tests and verify GREEN**

Run: `pnpm test src/app/guides/guides.test.tsx src/app/zh/route-exports.test.ts`

Expected: guide and route-export tests pass.

### Task 3: Add discoverability and parent-child links through TDD

- [ ] **Step 1: Extend existing navigation and topic-parent tests first**

Require `Guides`/`指南` in desktop and mobile navigation, footer links to the localized index, and all three guide links from the three-image topic parent.

- [ ] **Step 2: Run focused public-page tests and verify RED**

Run: `pnpm test src/components/public/public-pages.test.tsx src/app/three-images-to-clothing-video/page.test.tsx`

Expected: FAIL because the guide links are absent.

- [ ] **Step 3: Add header, mobile, footer, and topic-parent entries**

Reuse `publicNavigationItems` for desktop/mobile. Add one footer link in the existing Product section. Add a restrained “Practical guides/实用指南” band to the topic parent with three plain article rows, not nested cards.

- [ ] **Step 4: Re-run focused public-page tests and verify GREEN**

Run: `pnpm test src/components/public/public-pages.test.tsx src/app/three-images-to-clothing-video/page.test.tsx`

Expected: navigation/footer/parent link tests pass.

### Task 4: Add sitemap coverage through TDD

- [ ] **Step 1: Extend sitemap expectations before production data**

Add `/guides`, three English article paths, `/zh/guides`, and three Chinese article paths with `2026-08-03` last-modified dates.

- [ ] **Step 2: Run `pnpm test src/app/sitemap.test.ts` and verify RED**

Expected: FAIL with missing guide entries.

- [ ] **Step 3: Register all eight guide pages in `publicPages`**

Use monthly frequency and priorities below the topic pillar. Every entry must include its exact alternate path.

- [ ] **Step 4: Re-run the sitemap test and verify GREEN**

Run: `pnpm test src/app/sitemap.test.ts`

Expected: all sitemap assertions pass, including hreflang symmetry.

### Task 5: Documentation and final verification

- [ ] **Step 1: Update the content pack**

Record English-first keywords, `/guides/*` and `/zh/guides/*` URL pairs, and remove the obsolete statement that guide routes do not exist.

- [ ] **Step 2: Run focused verification**

Run: `pnpm test src/lib/guides/catalog.test.ts src/app/guides/guides.test.tsx src/components/public/public-pages.test.tsx src/app/three-images-to-clothing-video/page.test.tsx src/app/sitemap.test.ts src/app/zh/route-exports.test.ts`

Expected: all focused tests pass.

- [ ] **Step 3: Run type and lint gates**

Run: `pnpm typecheck` and `pnpm exec eslint src/lib/guides src/components/public/guide-pages.tsx src/app/guides src/app/zh/guides src/components/public/public-navigation.ts src/components/layout/site-footer-content.tsx src/app/three-images-to-clothing-video/page.tsx src/lib/seo/site.ts src/app/sitemap.test.ts src/app/zh/route-exports.test.ts`.

Expected: both commands exit 0.

- [ ] **Step 4: Run the full suite once at goal end**

Run: `pnpm test`.

Expected: all repository tests pass.

- [ ] **Step 5: Build and visually verify desktop/mobile**

Run `pnpm build`, start the dev server, and inspect `/guides`, one English article, `/zh/guides`, and one Chinese article at desktop and mobile widths. Confirm no horizontal overflow, broken images, overlapping text, or 404 internal links.
