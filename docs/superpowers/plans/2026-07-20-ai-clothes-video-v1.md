# AI Clothes Video V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 A RunwayTools 收敛为 `aiclothesvideo.com` 的可运行首版：用户按明确的三图协议上传单个 SKU 素材，完成分析、生成、预览和下载。

**Architecture:** 保留现有 Next.js、Neon/Drizzle、R2、DeepSeek、PixVerse、Cloud Run、Post-QA、Creem 和任务状态机。新增纯领域层的 capture protocol catalog，并把协议与可选 SKU 名称作为任务快照持久化；前端工作台根据协议渲染三个语义素材位，后端 Preflight 负责数量、角色、授权和现有模板门禁。

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, Drizzle ORM, Vitest, Testing Library, lucide-react.

---

## Product And Visual Contract

- Visual thesis: 冷静的服装制作台，用石墨黑、纸白和珊瑚红建立编辑感，让真实服装素材与成片成为唯一视觉主角。
- Content plan: 首页按 full-bleed hero -> 三图证据 -> 工作流 -> 最终 CTA；工作台按协议选择 -> 三图画布 -> 生成设置 -> 条件式高级层。
- Interaction thesis: hero 文案轻量进入；三图素材位使用上传/就绪状态转换；工作台设置和高级区使用短距离展开，不做装饰性漂浮动画。
- Primary task: 上传当前 SKU 的三张合规素材并创建一条完整宣传视频。
- Responsive contract: desktop 为主画布 + 直接影响提交的 inspector；tablet 保持两区但压缩 inspector；mobile 先素材画布、后设置、底部单一 sticky CTA。

## File Map

- `src/lib/video/capture-protocols.ts`: 三图协议的唯一 catalog、类型、角色规则和展示文案。
- `src/lib/video/capture-protocols.test.ts`: 协议数量、角色顺序和合法 ID 测试。
- `src/lib/db/schema/jobs.ts`: 任务协议与 SKU 名称字段。
- `drizzle/0017_capture_protocol.sql`: 新项目 forward migration。
- `src/server/jobs/preflight.ts`: 协议素材门禁。
- `src/server/jobs/create-job.ts`: 创建任务时持久化协议快照字段。
- `src/app/api/jobs/route.ts`、`src/app/api/jobs/preflight/route.ts`: 接收并传递新契约。
- `src/components/workspace/capture-protocol-selector.tsx`: 三种生成方式的 segmented selector。
- `src/components/workspace/upload-panel.tsx`: 根据协议只渲染三个语义素材位。
- `src/components/workspace/workspace-app.tsx`: 任务优先的工作台布局与请求载荷。
- `src/app/page.tsx`: 真实视频驱动的品牌首页。
- `src/app/globals.css`: token、字体、focus、motion 和全局表面规则。
- `src/components/brand/logo.tsx`: `AI Clothes Video` 品牌锁定。
- `src/components/workspace/WORKBENCH_IA.md`: 状态模型、信息分类、visibility 和 deferred blocks。
- `docs/AI_CLOTHES_VIDEO_UI_GUIDELINES.md`: 可复用 UI 使用规范。

### Task 1: Capture Protocol Domain Model

- [ ] **Step 1: Write the failing catalog test**

在 `src/lib/video/capture-protocols.test.ts` 断言：三个协议存在；每个协议恰好三个槽位；展示协议为 `front/back/detail`；两种转身协议为 `front/side/back`；未知值回退到展示协议。

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/lib/video/capture-protocols.test.ts`
Expected: FAIL because `capture-protocols.ts` does not exist.

- [ ] **Step 3: Implement the minimal catalog**

在 `src/lib/video/capture-protocols.ts` 导出 `CaptureProtocolId`、`CaptureProtocolSlot`、`captureProtocols`、`defaultCaptureProtocolId`、`getCaptureProtocol()` 和 `isCaptureProtocolId()`。协议 ID 使用 `product_showcase`、`product_rotation`、`model_turn`。

- [ ] **Step 4: Verify GREEN**

Run: `pnpm exec vitest run src/lib/video/capture-protocols.test.ts`
Expected: PASS.

### Task 2: Persist And Validate The Protocol

- [ ] **Step 1: Write failing schema, route and preflight tests**

扩展 `src/lib/db/schema/index.test.ts`、`src/app/api/jobs/route.test.ts`、`src/app/api/jobs/preflight/route.test.ts`、`src/server/jobs/preflight.test.ts`：任务 schema 暴露协议/SKU 字段；route 转发协议/SKU；展示协议缺少 back/detail 时返回可操作中文原因；三个正确角色可以继续现有模板门禁。

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/lib/db/schema/index.test.ts src/app/api/jobs/route.test.ts src/app/api/jobs/preflight/route.test.ts src/server/jobs/preflight.test.ts`
Expected: FAIL on missing contract fields and protocol validation.

- [ ] **Step 3: Implement persistence and request plumbing**

新增 `capture_protocol` enum、`video_jobs.capture_protocol`、`video_jobs.sku_name`，创建 `drizzle/0017_capture_protocol.sql`。API 仅接受合法协议，SKU 去空白并限制为 80 字；workspace 新请求必须携带协议。`createVideoJobWithAssets` 默认兼容 `product_showcase`，不修改账务、试用、状态事件和 QA 逻辑。

- [ ] **Step 4: Implement protocol-aware preflight**

以 catalog 的三个角色作为 `requiredAssetRoles`。每个缺失角色产生明确 reason；新工作台协议要求恰好三个唯一资产。现有授权、时长、比例、试用和模板数量检查继续执行。

- [ ] **Step 5: Verify GREEN**

Run: `pnpm exec vitest run src/lib/db/schema/index.test.ts src/app/api/jobs/route.test.ts src/app/api/jobs/preflight/route.test.ts src/server/jobs/preflight.test.ts src/server/jobs/create-job.test.ts`
Expected: PASS.

### Task 3: Three-Image Workspace

- [ ] **Step 1: Write failing component tests**

扩展 `upload-panel.test.tsx` 与 `workspace-app.test.tsx`：默认只出现正面/背面/细节；切换商品旋转后为正面/侧面/背面；请求包含 `captureProtocol`；不足三张时主 CTA 不可用；授权与上传失败状态保持可见。

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/components/workspace/upload-panel.test.tsx src/components/workspace/workspace-app.test.tsx`
Expected: FAIL on the old five-slot layout and missing protocol payload.

- [ ] **Step 3: Build protocol selector and dynamic uploader**

新增 `capture-protocol-selector.tsx`，使用真实 segmented control 语义；`UploadPanel` 接收 slots，并保持文件类型、预览、删除、失败重试、上传进度和权利声明能力。

- [ ] **Step 4: Recompose workspace around the primary task**

首屏只保留步骤/协议、三图主画布和直接影响生成的 inspector。模板分析与分镜进入单个高级 disclosure；状态信息紧邻主 CTA；SKU 名称为可选紧凑输入。移动端素材优先并使用稳定触控尺寸。

- [ ] **Step 5: Verify GREEN**

Run: `pnpm exec vitest run src/components/workspace/upload-panel.test.tsx src/components/workspace/workspace-app.test.tsx src/app/'(dashboard)'/workspace/page.test.tsx`
Expected: PASS.

### Task 4: Brand, Landing And Demonstration Assets

- [ ] **Step 1: Write failing brand and page tests**

扩展 `src/app/page.test.tsx`、`src/app/app-shell.test.ts` 和 public shell tests，断言品牌名、三图承诺、工作台 CTA、真实 demo video/source images、无旧 `RunwayTools` 可见品牌文案。

- [ ] **Step 2: Verify RED**

Run: `pnpm exec vitest run src/app/page.test.tsx src/app/app-shell.test.ts src/components/public/public-pages.test.tsx`
Expected: FAIL on old brand and landing structure.

- [ ] **Step 3: Install tokens before page composition**

在 `globals.css` 定义 background/surface/ink/muted/line/action/brand/success/warning/danger、type scale、radius、shadow 和 motion tokens；增加 visible focus 和 reduced-motion 规则。组件只消费语义 token。

- [ ] **Step 4: Add real demo media and rebuild the landing page**

复用 `test-assets/e2e` 的 front/back/detail 与 generated segment，复制到 `public/demo`。首页使用 edge-to-edge actual video hero，后续分别证明输入、流程和输出，不做 feature card grid。

- [ ] **Step 5: Replace product identity**

更新 logo lockup、metadata、headers、footer、登录、pricing、FAQ、任务下载名、health service name 和 README 中面向用户的品牌文案；保留法律/技术边界。

- [ ] **Step 6: Verify GREEN**

Run: `pnpm exec vitest run src/app/page.test.tsx src/app/app-shell.test.ts src/components/public/public-pages.test.tsx src/components/brand src/app/'(auth)'/login`
Expected: PASS.

### Task 5: Guidelines, Audit And Global Verification

- [ ] **Step 1: Update IA and reusable guidelines**

`WORKBENCH_IA.md` 必须包含 primary/secondary/low-frequency/rare goals、empty/uploading/validating/blocked/ready/submitted 状态、信息角色表、content audit、visibility plan 和每个 deferred block 的原因/触发器/容器。`AI_CLOTHES_VIDEO_UI_GUIDELINES.md` 必须包含 Usage、Layout、Anatomy、States & Spec、Interaction、Content / Asset。

- [ ] **Step 2: Run focused regression**

Run: `pnpm exec vitest run src/lib/video/capture-protocols.test.ts src/server/jobs/preflight.test.ts src/server/jobs/create-job.test.ts src/components/workspace/upload-panel.test.tsx src/components/workspace/workspace-app.test.tsx src/app/page.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run deterministic frontend audit**

Run: `python C:/Users/85006/.codex/skills/frontend-design/scripts/audit_frontend_principles.py . --require-workbench-ia --require-guideline-docs`
Expected: no FAIL; manual perception checks remain manual.

- [ ] **Step 4: Run the global gate once**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
Expected: all exit 0.

- [ ] **Step 5: Run browser visual QA**

Start `pnpm dev` on an available port. Capture desktop 1440x900 and mobile 390x844 screenshots for `/` and `/workspace`; verify the hero video is nonblank, three image slots render, text does not overlap, mobile has no horizontal overflow, and controls remain usable by keyboard.

## Scope Guard

- 不改变 Creem 金额、扣点事务、管理员权限、retention 和侵权流程。
- 不公开 40 秒、商品旋转或真人转身为默认能力。
- 不增加批量 SKU、订阅、团队、虚拟试衣或新 provider。
- 不把没有真实生产密钥的外部链路描述为已验收。
- 当前工作不自动 push 到 `origin`，也不把功能分支合并到 `main`。
