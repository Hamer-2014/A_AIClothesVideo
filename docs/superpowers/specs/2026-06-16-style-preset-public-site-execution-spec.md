# Style Preset + Public Site 执行 SPEC

日期：2026-06-16  
用途：交给新的开发 session 执行，实现 Style Preset 工作台入口与 Public Site 转化页。  
对应计划：[2026-06-16-style-preset-public-site.md](../plans/2026-06-16-style-preset-public-site.md)

## 1. 本次开发目标

实现 Style Preset 作为普通用户默认生成入口，并补齐前台 Public Site：

- 用户在 Landing / Pricing 点击试用后进入 `/workspace?mode=trial&preset=minimal_studio`。
- 工作台默认使用 preset，而不是要求普通用户理解镜头模板。
- 系统根据 preset、素材分析和模板规则自动选择 1/2/3 个模板。
- 模板选择保留为高级调整能力。
- 任务和分镜保存 `preset_id` 与 `preset_snapshot`，方便审计和复现。
- DeepSeek 分镜输入包含 preset 风格约束，但仍只能使用最终允许的模板 ID。
- 管理后台任务详情能看到 preset 信息。

## 2. 必读文档

新 session 开始前必须按顺序阅读：

1. [AGENTS.md](../../../AGENTS.md)
2. [docs/PRD.md](../../PRD.md)
3. [docs/STYLE_PRESET_DESIGN.md](../../STYLE_PRESET_DESIGN.md)
4. [docs/superpowers/plans/2026-06-16-style-preset-public-site.md](../plans/2026-06-16-style-preset-public-site.md)
5. [docs/DEVELOPMENT_SPEC.md](../../DEVELOPMENT_SPEC.md)

如果以上文档与用户最新指令冲突，以用户最新指令为准，但必须同步更新对应文档。

## 3. 核心产品原则

必须保持这些规则不变：

- Preset 是用户选择视频风格/用途的入口，不是模板权限规则。
- Preset 只能影响：
  - 默认生成意图。
  - prompt 风格基调。
  - 模板推荐排序。
  - 工作台默认时长/比例。
- Preset 不能绕过：
  - 无背面图禁止背面/转身/正背切换/360。
  - 无细节图禁止细节特写。
  - 无场景图禁止强场景生成。
  - 免费试用只开放低风险模板。
  - Creem Moderation。
  - Post-QA。
  - DeepSeek 只能引用已允许模板 ID。

一句话：**preset 只做排序和表达，不做越权。**

## 4. 开发范围

### 4.1 必做

按计划文件完成 Task 1 到 Task 8：

1. Preset catalog 与 recommendation helpers。
2. 模板推荐接入 preset 排序。
3. `video_jobs` / `storyboards` 保存 `preset_id` 和 `preset_snapshot`。
4. storyboard generation 接入 preset style hint。
5. workspace 支持 preset selector 与 query defaults。
6. Public Site：Landing、Pricing、Privacy、Terms。
7. Admin job detail 展示 preset。
8. 本地验证。

### 4.2 本次不做

- 不做 preset 后台编辑器。
- 不做运营热修改 preset prompt。
- 不做自动识别“用户应该用哪个 preset”。
- 不做匿名上传默认图片。
- 不改视频生成 provider/model 路由策略。
- 不改 Cloud Run stitch-worker。
- 不改 Creem 支付真实验收逻辑。

### 4.3 完成后暂不强制做

Task 9 是真实用户前 smoke gate。若本次只是完成代码开发，可不跑真实 paid smoke；但最终交付时必须明确说明：

```text
Task 9 未执行，需要在给真实用户试用前补跑。
```

如果当前 session 已具备真实数据库、R2、APIMart、Cloud Run、点数和测试账号条件，可以执行 Task 9，并把 job id 写入最终报告。

## 5. 推荐执行顺序

按计划文件执行，但注意 Task 2 和 Task 3 的依赖：

1. Task 1：先建 `src/lib/presets/*`。
2. Task 3：先加 schema/migration 和 job 持久化。
3. Task 2：再让推荐读取 `presetId`，否则 TypeScript schema 字段会缺。
4. Task 4：storyboard 接入 preset snapshot。
5. Task 5：workspace UI 和 query defaults。
6. Task 6：public pages。
7. Task 7：admin 可见性。
8. Task 8：本地验证。
9. Task 9：真实 smoke，视环境决定。

每个 Task 完成后建议单独 commit。

## 6. 关键文件

### 新增文件

- `src/lib/presets/types.ts`
- `src/lib/presets/catalog.ts`
- `src/lib/presets/recommend.ts`
- `src/lib/presets/index.ts`
- `src/lib/presets/catalog.test.ts`
- `src/lib/presets/recommend.test.ts`
- `src/components/workspace/style-preset-selector.tsx`
- `src/components/workspace/style-preset-selector.test.tsx`
- `src/components/public/public-header.tsx`
- `src/components/public/public-footer.tsx`
- `src/components/public/cta-link.tsx`
- `src/app/pricing/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `drizzle/0011_style_preset_snapshots.sql`

### 修改文件

- `src/app/page.tsx`
- `src/app/(dashboard)/workspace/page.tsx`
- `src/components/workspace/workspace-app.tsx`
- `src/components/workspace/workspace-app.test.tsx`
- `src/server/assets/analyze.ts`
- `src/server/assets/analyze.test.ts`
- `src/server/jobs/create-job.ts`
- `src/server/jobs/create-job.test.ts`
- `src/server/jobs/get-job.ts`
- `src/server/jobs/get-job.test.ts`
- `src/server/storyboard/generate.ts`
- `src/server/storyboard/generate.test.ts`
- `src/app/api/jobs/route.ts`
- `src/app/api/jobs/route.test.ts`
- `src/app/api/jobs/[id]/storyboard/route.ts`
- `src/app/api/jobs/[id]/storyboard/route.test.ts`
- `src/lib/db/schema/jobs.ts`
- `drizzle/meta/_journal.json`
- `src/server/admin/jobs.ts`
- `src/server/admin/jobs.test.ts`
- `src/components/admin/job-detail-panel.tsx`
- `src/components/admin/job-detail-panel.test.tsx`

## 7. 预期用户流程

### 7.1 Public Site

```text
访问 /
  -> 看到 Landing，不再直接跳 /login
  -> 点击 免费生成 1 条试用视频
  -> /login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio
  -> 登录后进入 /workspace?mode=trial&preset=minimal_studio
```

### 7.2 Workspace 默认试用

进入 `/workspace?mode=trial&preset=minimal_studio` 后：

- preset 默认选中“极简棚拍”。
- 时长默认 8 秒。
- 比例默认 9:16。
- 显示免费试用入口。
- 生成意图默认来自 `minimal_studio.defaultIntent`。
- 用户上传素材后，系统自动推荐模板组合。
- 用户可直接一键生成，也可展开高级调整模板。

### 7.3 生成链路

```text
preset + userIntent + assets
  -> asset analysis
  -> template rule hard filtering
  -> preset ranking
  -> selected template ids
  -> DeepSeek storyboard
  -> moderation
  -> segment generation
  -> stitch
  -> Post-QA
  -> deliverable
```

## 8. 数据要求

### 8.1 video_jobs

新增字段：

```text
preset_id text
preset_snapshot jsonb
```

创建 job 时必须保存：

```json
{
  "id": "minimal_studio",
  "label": "极简棚拍",
  "preferredTemplateIds": ["minimal_studio", "front_push_in", "front_pan"],
  "promptStyleHint": "clean studio product video..."
}
```

### 8.2 storyboards

新增字段：

```text
preset_id text
preset_snapshot jsonb
```

生成 storyboard 时保存 job 上的 preset snapshot。

### 8.3 DeepSeek 输入

DeepSeek 输入中应包含：

```json
{
  "style_preset": {
    "id": "marketplace_clean",
    "label": "电商主图动效",
    "prompt_style_hint": "clean ecommerce product motion"
  }
}
```

但 DeepSeek 仍然只能使用 `selected_template_ids`。

## 9. 测试要求

开发时按计划中的 task 跑局部测试。最终至少跑：

```bash
npx vitest run src/lib/presets/catalog.test.ts src/lib/presets/recommend.test.ts src/server/assets/analyze.test.ts src/server/jobs/create-job.test.ts src/server/jobs/get-job.test.ts src/server/storyboard/generate.test.ts src/components/workspace/style-preset-selector.test.tsx src/components/workspace/workspace-app.test.tsx src/server/admin/jobs.test.ts src/components/admin/job-detail-panel.test.tsx src/lib/db/migrations.test.ts
npm run typecheck
npm test
npm run build
```

如果某条命令失败，必须修复或在最终报告里明确说明失败命令、失败原因、未完成范围。不能说“应该没问题”。

## 10. 验收交付要求

新 session 完成后，最终报告必须包含：

- 完成了哪些 Task。
- 每个 commit hash 和 commit message。
- 跑过的命令与结果。
- 是否执行 Task 9。
- 如果未执行 Task 9，明确写：

```text
真实 paid smoke / verify:blockers 未执行，需在真实用户试用前补跑。
```

- 需要当前 session 验收的重点文件。
- 已知风险或遗留问题。

## 11. 我方后续验收重点

开发 session 完成后，验收者重点检查：

- `/` 是否真的变成 Landing，而不是继续 redirect。
- Landing CTA 是否带 `mode=trial&preset=minimal_studio`。
- Workspace 是否读取 query 默认值。
- Preset 是否是结构化配置，不是一段 prompt。
- Preset 是否只影响排序，不启用不可用模板。
- 无背面图、无细节图、无场景图规则是否仍然生效。
- `video_jobs` 和 `storyboards` 是否保存 preset id/snapshot。
- DeepSeek 输入是否包含 preset style hint。
- Admin 是否可见 preset 信息。
- 测试、typecheck、build 是否有新鲜输出。

## 12. 重要提醒

这次功能看起来像“前端体验优化”，但实际会碰到推荐、数据库、分镜和审计。不要只做 UI。

反过来，也不要上来就做复杂运营配置。MVP 只需要代码配置的 3 个 preset。你要是现在做后台编辑 preset，相当于把安全规则旁边开了个小门，后面谁都可能把 prompt 改歪。别给未来的自己找罪受。

