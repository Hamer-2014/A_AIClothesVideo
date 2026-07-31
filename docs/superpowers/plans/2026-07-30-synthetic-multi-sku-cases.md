# Synthetic Multi-SKU Cases And Preset Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 建立可追溯的三 SKU 合成演示案例体系，并用同一 SKU 通过真实项目生成链路产出三种 Style Preset 的可比较视觉预览。

**Architecture:** 案例元数据由类型化 catalog 统一管理，公开页面只读取经过验收并落盘到 public/demo 的静态图片、视频和审计元数据。英文与中文路由复用同一页面实现；首页只增加一个精简案例入口，完整信息放在 /examples 与 /examples/[slug]。图片属于合成演示输入，视频必须来自当前项目真实生成链路，但不声称是客户案例、客户指标或生产稳定性证明。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4、Vitest、Testing Library、ImageGen、项目现有 DeepSeek/APIMart/R2/Cloud Run 链路、ffmpeg。

---

## Scope And Truthfulness Contract

- 交付 3 个不同服装品类：红色连衣裙、结构化西装外套、针织开衫。
- 红色连衣裙复用现有三图与现有真实工作流视频，不反推或伪造未知的 provider、model、prompt 和 Preset。
- 新生成上限为 4 条 8 秒视频：同一西装 SKU 的 minimal_studio、marketplace_clean、social_lifestyle，以及针织开衫的一条 marketplace_clean。
- 所有新图片标记为 synthetic-demo；所有新视频标记为 generated-from-synthetic-input。
- social_lifestyle 没有场景图或模特图时只能产生弱背景、低风险商品动效，不得包装成街拍或真人生活方式视频。
- 不新增 testimonial、客户 logo、GMV、转化率、生成成功率或“真实客户”措辞。
- 不修改认证、支付、点数、数据库 schema、moderation fail-closed、模板权限和供应商路由。
- 若 ImageGen CLI 未获明确授权、环境缺少 OPENAI_API_KEY、项目链路无法建立测试任务、或预计生成超过 4 条，停止并报告，不用占位图或伪视频绕过。

## Information Architecture

Primary job：让访客检查“同一组真实输入如何在不同 Preset 下得到不同但受素材边界约束的输出”。

| 信息 | 分类 | 首屏 | 显示条件 | 容器 |
|---|---|---:|---|---|
| 主案例视频与合成演示声明 | action-critical | 是 | 始终 | 全宽媒体 Hero |
| 三个 SKU 索引 | decision-supporting | 否 | catalog 有已验收输出 | 分隔线列表 |
| 三 Preset 同源比较 | decision-supporting | 否 | controlled SKU 三条输出齐全 | 分段控件 + 单一主视频 |
| 三张输入图 | reference | 否 | 案例详情 | 三列素材带 |
| Prompt、provider、hash、日期 | audit/history | 否 | 展开“生成记录” | details |
| 生成失败或缺失输出 | exception-handling | 否 | catalog 校验失败 | 不发布该案例 |
| 进入工作台 CTA | action-critical | 是 | Hero 与页尾 | 现有 CTA 组件 |

## File Map

- Create: src/lib/demo-cases/types.ts
- Create: src/lib/demo-cases/catalog.ts
- Create: src/lib/demo-cases/catalog.test.ts
- Create: src/components/public/demo-case-list.tsx
- Create: src/components/public/demo-case-list.test.tsx
- Create: src/components/public/preset-preview.tsx
- Create: src/components/public/preset-preview.test.tsx
- Create: src/components/public/examples-page.tsx
- Create: src/components/public/example-detail-page.tsx
- Create: src/app/examples/page.tsx
- Create: src/app/examples/page.test.tsx
- Create: src/app/examples/[slug]/page.tsx
- Create: src/app/examples/[slug]/page.test.tsx
- Create: src/app/zh/examples/page.tsx
- Create: src/app/zh/examples/[slug]/page.tsx
- Modify: src/components/public/sample-video.tsx
- Modify: src/components/public/sample-video.test.tsx
- Modify: src/app/page.tsx
- Modify: src/app/page.test.tsx
- Modify: src/app/zh/route-exports.test.ts
- Modify: docs/AI_CLOTHES_VIDEO_UI_GUIDELINES.md
- Create: public/demo/cases/structured-blazer/front.webp
- Create: public/demo/cases/structured-blazer/back.webp
- Create: public/demo/cases/structured-blazer/detail.webp
- Create: public/demo/cases/structured-blazer/minimal-studio.mp4
- Create: public/demo/cases/structured-blazer/minimal-studio-poster.webp
- Create: public/demo/cases/structured-blazer/marketplace-clean.mp4
- Create: public/demo/cases/structured-blazer/marketplace-clean-poster.webp
- Create: public/demo/cases/structured-blazer/social-lifestyle.mp4
- Create: public/demo/cases/structured-blazer/social-lifestyle-poster.webp
- Create: public/demo/cases/structured-blazer/metadata.json
- Create: public/demo/cases/knit-cardigan/front.webp
- Create: public/demo/cases/knit-cardigan/back.webp
- Create: public/demo/cases/knit-cardigan/detail.webp
- Create: public/demo/cases/knit-cardigan/marketplace-clean.mp4
- Create: public/demo/cases/knit-cardigan/marketplace-clean-poster.webp
- Create: public/demo/cases/knit-cardigan/metadata.json
- Create: public/demo/cases/red-dress/metadata.json
- Create: docs/verification/2026-07-30-multi-sku-cases/README.md
- Create: docs/verification/2026-07-30-multi-sku-cases/*.png

### Task 1: Close The Previous Homepage Plan

- [ ] **Step 1: Mark completed steps and record evidence**

Update docs/superpowers/plans/2026-07-30-competitor-informed-landing-page.md so all 28 completed steps are checked. Add the five commit hashes, 210/210 files, 1046/1046 tests, ESLint/typecheck/audit/diff-check results, six viewport checks, and the fact that no screenshot files were persisted.

- [ ] **Step 2: Verify the document**

Run:

~~~~powershell
rg -n "^- \[ \]" docs/superpowers/plans/2026-07-30-competitor-informed-landing-page.md
git diff --check
~~~~

Expected: rg has no matches and git diff --check has no whitespace errors.

- [ ] **Step 3: Commit**

~~~~powershell
git add docs/superpowers/plans/2026-07-30-competitor-informed-landing-page.md docs/superpowers/plans/2026-07-30-synthetic-multi-sku-cases.md
git commit -m "docs: close landing plan and define demo cases"
~~~~

### Task 2: Generate And Validate Synthetic Source Assets

- [ ] **Step 1: Generate one contact sheet per new SKU**

Use ImageGen with one separate generation call for each SKU. Save the selected originals outside public first, then crop three equal panels into front.webp, back.webp, and detail.webp. Do not use transparent-background fallback.

Structured blazer prompt:

~~~~text
Use case: product-mockup
Asset type: three-view source sheet for a clothing-video demo
Primary request: one cobalt-blue structured single-breasted blazer shown as three photographs of the exact same garment
Scene/backdrop: seamless neutral light-gray ecommerce studio
Subject: left panel front view, center panel back view, right panel close detail of lapel, button and wool texture
Style/medium: photorealistic apparel product photography, invisible mannequin
Composition/framing: 3 equal vertical panels with clean gutters; full garment centered in front and back panels; detail fills the third panel
Lighting/mood: soft even studio light, accurate color
Constraints: exact same garment, color, buttons, seams and proportions in all panels; no person; no logo; no text; no watermark
Avoid: invented trims, extra pockets, asymmetry, props, dramatic shadow, cropped garment in front/back panels
~~~~

Knit cardigan prompt:

~~~~text
Use case: product-mockup
Asset type: three-view source sheet for a clothing-video demo
Primary request: one sage-green rib-knit button cardigan shown as three photographs of the exact same garment
Scene/backdrop: seamless warm-white ecommerce studio
Subject: left panel front view, center panel back view, right panel close detail of neckline, buttons and rib-knit texture
Style/medium: photorealistic apparel product photography, invisible mannequin
Composition/framing: 3 equal vertical panels with clean gutters; full garment centered in front and back panels; detail fills the third panel
Lighting/mood: soft even studio light, accurate knit texture
Constraints: exact same garment, color, buttons, knit direction and proportions in all panels; no person; no logo; no text; no watermark
Avoid: added embroidery, extra buttons, props, dramatic shadow, cropped garment in front/back panels
~~~~

- [ ] **Step 2: Validate source boundaries**

Inspect all six images at original resolution. Reject the SKU if front and back disagree on color, length, button count, pocket placement, silhouette, or material. Confirm the detail crop visibly belongs to the same SKU.

- [ ] **Step 3: Normalize files**

Use ImageMagick or another deterministic local image tool:

~~~~powershell
magick input.png -crop 33.333%x100%+0+0 -resize "1200x1200>" -quality 84 public/demo/cases/structured-blazer/front.webp
~~~~

Repeat with the correct crop offsets for back/detail and the cardigan sheet. Every WebP longest edge must be at most 1200 px.

- [ ] **Step 4: Record hashes**

Run:

~~~~powershell
Get-FileHash public/demo/cases/*/*.webp -Algorithm SHA256
~~~~

Store exact SHA-256 values, final ImageGen prompts, generation date, sourceType synthetic-demo, and the material limits in each metadata.json.

### Task 3: Produce Four Real Workflow Videos

- [ ] **Step 1: Establish the test execution boundary**

Copy the ignored .env.local into the isolated worktree without committing it. Start the app on an unused local port. Use a project-owned test user and create jobs with isTest=true. Keep Creem moderation enabled and fail closed. Confirm the selected route is APIMart PixVerse V6 before submission.

- [ ] **Step 2: Submit the controlled blazer comparison**

Upload the same three blazer files for three independent 8-second jobs:

| Output | presetId | Expected low-risk preference |
|---|---|---|
| minimal-studio.mp4 | minimal_studio | minimal_studio or front_push_in |
| marketplace-clean.mp4 | marketplace_clean | product_float or front_pan |
| social-lifestyle.mp4 | social_lifestyle | minimal_studio, front_push_in, or front_pan; no invented strong scene |

Do not enable product rotation, model templates, back transitions without supported source roles, or manual prompt overrides that bypass the preset.

- [ ] **Step 3: Submit the cardigan representative case**

Create one 8-second marketplace_clean job from the cardigan front/back/detail inputs. Use only the templates returned as eligible by preflight.

- [ ] **Step 4: Wait for actual deliverables**

Drive the existing worker/tick flow until each job reaches deliverable or a terminal failure. Do not retry the same failure more than twice. Record job status, selected template IDs, provider/model, preset snapshot, moderation result, generatedAt, duration, ratio, and final asset key in a private execution note; publish no provider task ID or user ID.

- [ ] **Step 5: Export and normalize outputs**

Download the four final R2 objects into their planned public paths. Normalize each file:

~~~~powershell
ffmpeg -y -i input.mp4 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an output.mp4
ffmpeg -y -ss 00:00:04 -i output.mp4 -frames:v 1 -vf "scale=720:-1" -quality 82 poster.webp
~~~~

Confirm each MP4 is H.264, silent, 8 seconds within provider tolerance, nonblank, and visually consistent with the SKU.

- [ ] **Step 6: Update public metadata**

Write the truthful provider/model, preset ID, template IDs, input hashes, output hash, generated date, duration, aspect ratio, and disclaimer into metadata.json. The red-dress metadata must use unknown for facts not proven by existing records.

### Task 4: Define The Typed Case Catalog With TDD

- [ ] **Step 1: Write the failing catalog tests**

Create src/lib/demo-cases/catalog.test.ts:

~~~~ts
import { describe, expect, it } from "vitest";
import { demoCases, getDemoCase, presetComparisonCase } from "./catalog";

describe("demo case catalog", () => {
  it("publishes three distinct garment categories without customer claims", () => {
    expect(demoCases).toHaveLength(3);
    expect(new Set(demoCases.map((item) => item.category)).size).toBe(3);
    expect(demoCases.map((item) => item.sourceType)).toEqual([
      "internal-demo",
      "synthetic-demo",
      "synthetic-demo",
    ]);
  });

  it("compares all MVP presets on one controlled SKU", () => {
    expect(presetComparisonCase.slug).toBe("structured-blazer");
    expect(presetComparisonCase.outputs.map((item) => item.presetId)).toEqual([
      "minimal_studio",
      "marketplace_clean",
      "social_lifestyle",
    ]);
    expect(new Set(presetComparisonCase.outputs.map((item) => item.sourceSetId)).size).toBe(1);
  });

  it("returns no case for an unknown slug", () => {
    expect(getDemoCase("missing")).toBeNull();
  });
});
~~~~

- [ ] **Step 2: Run RED**

~~~~powershell
pnpm exec vitest run src/lib/demo-cases/catalog.test.ts
~~~~

Expected: FAIL because catalog.ts does not exist.

- [ ] **Step 3: Implement minimal types and catalog**

Define LocalizedText, DemoSourceAsset, DemoOutput, and DemoCase. Every DemoOutput must include presetId, sourceSetId, videoSrc, posterSrc, durationSeconds, aspectRatio, templateIds, provider, model, generatedAt, and disclosure. Populate exactly the three accepted cases and export getDemoCase plus presetComparisonCase.

- [ ] **Step 4: Run GREEN**

~~~~powershell
pnpm exec vitest run src/lib/demo-cases/catalog.test.ts
~~~~

Expected: 3 tests pass.

### Task 5: Generalize Video Playback And Build Preset Comparison With TDD

- [ ] **Step 1: Write failing SampleVideo prop tests**

Add a test proving custom src and poster are rendered while current callers still receive the red-dress defaults.

~~~~tsx
render(
  <SampleVideo
    controls
    poster="/demo/cases/structured-blazer/minimal-studio-poster.webp"
    sourcePage="examples"
    src="/demo/cases/structured-blazer/minimal-studio.mp4"
    testId="case-video"
  />,
);
expect(screen.getByTestId("case-video")).toHaveAttribute(
  "src",
  "/demo/cases/structured-blazer/minimal-studio.mp4",
);
~~~~

- [ ] **Step 2: Run RED and implement optional media props**

Run the focused file, confirm the expected failure, then add src and poster props with the current red-dress paths as defaults. Do not change tracking or reduced-motion behavior.

- [ ] **Step 3: Write failing PresetPreview interaction tests**

Assert that all three preset names are available, only the selected video is rendered, selecting marketplace_clean changes src, and the synthetic-demo disclosure remains visible.

- [ ] **Step 4: Run RED and implement the component**

Implement an accessible segmented control with buttons using aria-pressed. Render one stable 9:16 video area, selected preset boundary copy, and a details disclosure for generation metadata. Buttons must be at least 44 px and keep stable dimensions.

- [ ] **Step 5: Run GREEN**

~~~~powershell
pnpm exec vitest run src/components/public/sample-video.test.tsx src/components/public/preset-preview.test.tsx
~~~~

### Task 6: Build The Case Index And Detail Routes With TDD

- [ ] **Step 1: Write failing component and route tests**

Cover:

- /examples renders the synthetic-demo disclosure, three categories, and three-Preset comparison.
- Case list links use /examples/[slug] in English and /zh/examples/[slug] in Chinese.
- /examples/[slug] renders three source roles, the accepted featured output, Preset and generation record.
- Unknown slugs call notFound.
- Chinese export routes expose page and metadata without dynamic imports inside tests.

- [ ] **Step 2: Run RED**

~~~~powershell
pnpm exec vitest run src/components/public/demo-case-list.test.tsx src/app/examples/page.test.tsx "src/app/examples/[slug]/page.test.tsx" src/app/zh/route-exports.test.ts
~~~~

Expected: FAIL because the routes and components do not exist.

- [ ] **Step 3: Implement the index**

Build a media-led Hero using the structured blazer minimal-studio video, followed by one unframed divider list of three cases and one Preset comparison band. Use existing PublicHeader, PublicFooter, TrialCtaLink/WorkspaceCtaLink, localizeHref, and semantic color tokens.

- [ ] **Step 4: Implement the detail page**

Render title/disclosure, featured output, three source images, supported/unsupported material boundaries, and collapsed generation audit. Do not nest cards and do not expose provider task IDs.

- [ ] **Step 5: Add route wrappers and metadata**

English routes own the implementation. Chinese wrappers re-export page and metadata. generateStaticParams returns the three accepted slugs. Canonical/hreflang alternate paths must be locale-correct.

- [ ] **Step 6: Run GREEN**

Run the four focused files and expect all tests to pass.

### Task 7: Add A Narrow Homepage Entry With TDD

- [ ] **Step 1: Write failing bilingual homepage tests**

Assert one Examples section heading, exactly three case links, a visible synthetic-demo disclosure, and locale-correct /examples URLs. Keep existing workflow, preset, CTA, and red-dress evidence assertions unchanged.

- [ ] **Step 2: Run RED**

~~~~powershell
pnpm exec vitest run src/app/page.test.tsx
~~~~

- [ ] **Step 3: Implement one editorial case band**

Insert the band after the existing Style Preset section. Use one dominant video/image plus a compact three-row index; do not add three floating cards. Add a single “Explore generated cases” command link.

- [ ] **Step 4: Update the UI guideline**

Clarify that “真实生成样片” means output produced by the real project workflow. Allow synthetic input only when it is prominently labeled and traceable, and prohibit describing it as a customer case.

- [ ] **Step 5: Run GREEN**

~~~~powershell
pnpm exec vitest run src/app/page.test.tsx src/components/public/demo-case-list.test.tsx
~~~~

### Task 8: Focused Gates, Browser Evidence, And One Full Suite

- [ ] **Step 1: Run focused code gates**

~~~~powershell
pnpm exec vitest run src/lib/demo-cases/catalog.test.ts src/components/public/sample-video.test.tsx src/components/public/preset-preview.test.tsx src/components/public/demo-case-list.test.tsx src/app/examples/page.test.tsx "src/app/examples/[slug]/page.test.tsx" src/app/page.test.tsx src/app/zh/route-exports.test.ts
pnpm exec eslint src/lib/demo-cases src/components/public src/app/examples src/app/zh/examples src/app/page.tsx src/app/page.test.tsx
pnpm run typecheck
~~~~

- [ ] **Step 2: Run deterministic frontend audit**

~~~~powershell
python "$env:USERPROFILE/.codex/skills/frontend-design/scripts/audit_frontend_principles.py" .
~~~~

Expected: no FAIL.

- [ ] **Step 3: Verify media pixels and metadata**

Use ffprobe for codec, duration, dimensions and audio absence. Use canvas screenshots or extracted frames to prove every video is nonblank. Recompute SHA-256 and compare with metadata.json.

- [ ] **Step 4: Browser QA and durable screenshots**

Inspect /examples, /zh/examples, and /examples/structured-blazer at 390 x 844, 768 x 1024, and 1440 x 900. Verify no overflow/overlap, visible focus, locale purity, working segmented controls, nonblank video, no media 404, and reduced-motion pause. Save screenshots under docs/verification/2026-07-30-multi-sku-cases and record URL, viewport, commit, observations, and console status in README.md.

- [ ] **Step 5: Run the full stage gate once**

~~~~powershell
pnpm exec vitest run --maxWorkers=2
pnpm run lint
pnpm run typecheck
git diff --check origin/main..HEAD
~~~~

Report actual file/test counts from this run. Do not reuse the 210/1046 baseline as final evidence.

## Acceptance Matrix

| Requirement | Automated evidence | Manual/browser evidence |
|---|---|---|
| Three distinct SKU categories | catalog.test.ts | Case index media inspection |
| No fake customer proof | sourceType/disclosure assertions | Copy review |
| Same-source three-Preset comparison | sourceSetId and preset assertions | Toggle and garment-consistency inspection |
| Material boundaries remain enforced | catalog boundary fields | Video frame review |
| English/Chinese routes are complete | route/page tests | Locale-purity check |
| Media is real and reproducible | metadata schema, hashes, ffprobe | Nonblank pixel/frame inspection |
| Homepage stays focused | scoped page assertions | 390/768/1440 hierarchy check |
| Reduced motion/accessibility preserved | SampleVideo and component tests | Keyboard and reduced-motion browser check |

## Stop Conditions

- ImageGen or provider calls require an unapproved fallback, exceed four new 8-second outputs, or expose unexpected charges.
- Any source set fails same-garment consistency.
- Any output invents a back, detail, model, strong scene, logo, or construction not supported by inputs.
- A job touches a non-test user, consumes customer credits, or cannot be separated from production analytics.
- The same generation or implementation defect fails after two repair attempts.
- Work expands into testimonials, analytics dashboards, SEO content, authentication, billing, schema, or provider-routing changes.
