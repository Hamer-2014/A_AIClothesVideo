# Env-only 验收口径收敛实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `verify:blockers`、核心文档和少量代码噪音统一到当前 env-only APIMart PixVerse V6 视频生成口径。

**Architecture:** 不改变公开视频生成运行时，只修正验收标准和文档。`verify:blockers` 继续证明付费商业闭环，但 provider/model 证据来自 `video_segments` 与 `provider_call_logs.provider/model`，不再来自 DB route snapshot。

**Tech Stack:** Next.js, TypeScript, Vitest, Node.js scripts, Drizzle/Neon SQL, APIMart PixVerse V6, Cloud Run stitch-worker.

---

## 上下文

当前真实运行口径：

- 公开视频生成是 env-only。
- 运行时读取 `VIDEO_GENERATION_PROVIDER`、`VIDEO_GENERATION_MODEL`、当前 provider 的 API key。
- 默认 provider/model 是 `apimart` / `pixverse-v6`。
- DB `model_routes/provider_keys` 不再决定公开视频生成运行时。

当前问题：

- `scripts/verify-blockers.mjs` 和 `scripts/lib/blocker-verification-utils.mjs` 仍要求 `provider_call_logs.model_route_id` 与 `route_snapshot`。
- 这会把正确的 env-only paid delivery 误判为失败。

本地工作区提醒：

- `next-env.d.ts` 可能已有 Next.js 自动生成差异。不要无声混入提交。必须在任务 5 明确恢复或说明为什么提交。

## 文件边界

- `scripts/lib/blocker-verification-utils.mjs`：修改 blocker 业务判断，去掉 route snapshot 要求，增加 provider call log provider/model 要求。
- `scripts/lib/blocker-verification-utils.test.ts`：更新单测，覆盖“无 route snapshot 也可通过”和“缺 provider call log provider/model 会失败”。
- `scripts/verify-blockers.mjs`：修改真实库 SQL 聚合，加载 `provider_call_logs.provider/model`。
- `scripts/mjs-modules.d.ts`：只有类型检查需要时才改。
- `docs/API_TEST_STATUS.md`：记录新的 env-only 验收口径和未完成真实 smoke。
- `docs/IMPLEMENTATION_PLAN.md`：同步当前快照。
- `docs/DEVELOPMENT_SPEC.md`：清理“不默认生成音频”等旧口径。
- `docs/TECHNICAL_ARCHITECTURE.md`：确认公开视频生成 provider/model/key 由环境变量决定。
- `docs/verification/backend-api-blockers.md`：更新 blocker 证据要求。
- `docs/verification/model-route-audit-2026-06-12.md`：标记 route snapshot 为历史，不作为当前验收依据。
- `docs/API_FLOW.md`：只有仍有旧 blocker 口径时才改。
- `src/lib/providers/apimart/video.ts`：删除 `//resolution: "360p"` 残留注释。
- `next-env.d.ts`：恢复或明确提交理由。

---

## 任务 1：先更新 blocker 单测

**Files:**
- 修改：`scripts/lib/blocker-verification-utils.test.ts`

- [ ] **Step 1：查看现有测试**

运行：

```bash
Get-Content -Path scripts/lib/blocker-verification-utils.test.ts
```

预期：能看到提到 route snapshot、`videoRouteLogCount` 或 missing route snapshot 的测试。

- [ ] **Step 2：删除旧 route snapshot 缺失测试**

删除名称等价于下面的测试：

```js
it("fails paid delivery evidence when route snapshot log is missing", () => {
});
```

不要删除仍然验证 `reserve`、`capture`、final video、QA frames、`apimart/pixverse-v6` segment 证据的测试。

- [ ] **Step 3：新增 env-only provider/model 通过测试**

在 paid delivery 相关 describe/test 区域新增：

```js
it("passes paid delivery evidence with env-only provider/model logs and no route snapshot", () => {
  const result = evaluatePaidDeliveryEvidence([
    {
      id: "job-paid",
      status: "deliverable",
      creditCost: 70,
      ledgerTypes: ["reserve", "capture"],
      finalVideoKey: "jobs/job-paid/stitched/final.mp4",
      qaFrameCount: 3,
      videoProviders: ["apimart"],
      videoModels: ["pixverse-v6"],
      providerLogProviders: ["apimart"],
      providerLogModels: ["pixverse-v6"],
      videoProviderLogCount: 1,
    },
  ]);

  expect(result.passed).toBe(true);
  expect(result.reason).toContain("env-only apimart/pixverse-v6");
});
```

- [ ] **Step 4：新增 provider call log 缺失失败测试**

新增：

```js
it("fails paid delivery evidence when provider call log provider/model evidence is missing", () => {
  const result = evaluatePaidDeliveryEvidence([
    {
      id: "job-paid",
      status: "deliverable",
      creditCost: 70,
      ledgerTypes: ["reserve", "capture"],
      finalVideoKey: "jobs/job-paid/stitched/final.mp4",
      qaFrameCount: 3,
      videoProviders: ["apimart"],
      videoModels: ["pixverse-v6"],
      providerLogProviders: [],
      providerLogModels: [],
      videoProviderLogCount: 0,
    },
  ]);

  expect(result.passed).toBe(false);
  expect(result.reason).toContain("provider call log");
});
```

- [ ] **Step 5：先跑测试确认红灯**

运行：

```bash
npx vitest run scripts/lib/blocker-verification-utils.test.ts
```

预期：至少一个测试失败，因为实现仍在期待 `videoRouteLogCount` / route snapshot。

如果新增测试立刻通过，说明实现可能已被其他 session 改过。继续任务 3 检查 SQL loader，不要重复改。

---

## 任务 2：更新 blocker 判断逻辑

**Files:**
- 修改：`scripts/lib/blocker-verification-utils.mjs`

- [ ] **Step 1：替换 paid next steps**

把 `paidNextSteps` 改成：

```js
const paidNextSteps = [
  "Create or select a real job with credit_cost > 0.",
  "Run npm run smoke:backend -- --job-id <paid-job-id>.",
  "Confirm credit_ledger contains reserve and capture for that job.",
  "Confirm video_segments contains provider/model evidence: apimart/pixverse-v6.",
  "Confirm provider_call_logs contains video_generation provider/model evidence: apimart/pixverse-v6.",
];
```

- [ ] **Step 2：移除 route snapshot 断言**

在 `evaluatePaidDeliveryEvidence` 中保留这些断言：

- `reserve`
- `capture`
- final video key
- QA frames
- `videoProviders` / `videoModels` 包含 `apimart` / `pixverse-v6`

删除：

```js
if (!job.videoRouteLogCount || job.videoRouteLogCount <= 0) {
  failures.push(`${job.id} missing provider call route snapshot`);
  continue;
}
```

- [ ] **Step 3：新增 provider call log provider/model 断言**

在 segment provider/model 断言之后加入：

```js
const logProviders = new Set(job.providerLogProviders ?? []);
const logModels = new Set(job.providerLogModels ?? []);
if (
  !job.videoProviderLogCount ||
  job.videoProviderLogCount <= 0 ||
  !logProviders.has("apimart") ||
  !logModels.has("pixverse-v6")
) {
  failures.push(`${job.id} missing provider call log apimart/pixverse-v6 evidence`);
  continue;
}
```

- [ ] **Step 4：更新通过原因**

把 paid delivery 通过原因改成：

```js
reason: "Paid deliverable job has reserve, capture, final video, QA frames, and env-only apimart/pixverse-v6 provider/model evidence.",
```

- [ ] **Step 5：跑 focused test**

运行：

```bash
npx vitest run scripts/lib/blocker-verification-utils.test.ts
```

预期：该测试文件全部通过。

- [ ] **Step 6：提交任务 1-2**

运行：

```bash
git add scripts/lib/blocker-verification-utils.mjs scripts/lib/blocker-verification-utils.test.ts
git commit -m "fix: align blocker evidence with env video config"
```

如果 `git status` 里出现 `next-env.d.ts`，不要加入本提交。

---

## 任务 3：更新真实库 SQL loader

**Files:**
- 修改：`scripts/verify-blockers.mjs`
- 按需修改：`scripts/mjs-modules.d.ts`

- [ ] **Step 1：查看 paid delivery query**

运行：

```bash
Get-Content -Path scripts/verify-blockers.mjs | Select-Object -First 120
```

预期：当前能看到 `pcl.model_route_id is not null` 和 `pcl.route_snapshot is not null`。

- [ ] **Step 2：替换 provider call log 聚合字段**

在 `loadPaidDeliveryCandidates` 的 SQL 中，用下面字段替换 `video_route_log_count`：

```sql
      coalesce(
        array_remove(
          array_agg(distinct pcl.provider) filter (
            where pcl.purpose = 'video_generation'
          ),
          null
        ),
        array[]::text[]
      ) as provider_log_providers,
      coalesce(
        array_remove(
          array_agg(distinct pcl.model) filter (
            where pcl.purpose = 'video_generation'
          ),
          null
        ),
        array[]::text[]
      ) as provider_log_models,
      count(distinct pcl.id) filter (
        where pcl.purpose = 'video_generation'
      ) as video_provider_log_count,
```

不要再要求 `model_route_id` 或 `route_snapshot`。

- [ ] **Step 3：更新 row mapping**

把：

```js
videoRouteLogCount: Number(row.video_route_log_count ?? 0),
```

替换为：

```js
providerLogProviders: asStringArray(row.provider_log_providers),
providerLogModels: asStringArray(row.provider_log_models),
videoProviderLogCount: Number(row.video_provider_log_count ?? 0),
```

- [ ] **Step 4：搜索脚本残留**

运行：

```bash
rg -n "videoRouteLogCount|video_route_log_count|model_route_id is not null|route_snapshot is not null|provider call route snapshot" scripts
```

预期：active verifier 代码和测试无命中。

- [ ] **Step 5：跑脚本单测**

运行：

```bash
npx vitest run scripts/lib/blocker-verification-utils.test.ts
```

预期：通过。

- [ ] **Step 6：尝试运行真实 blocker 验证**

运行：

```bash
npm run verify:blockers -- --json
```

预期：

- 如果 `.env.local` 有 `DATABASE_URL`，命令会查真实库。
- 如果真实证据完整，可能通过。
- 如果真实库缺 env-only paid delivery 或 provider call log provider/model 证据，可能失败。
- 如果缺环境变量，可能报 `DATABASE_URL is required.`
- 失败原因不能再是 route snapshot 缺失。

不要为了让命令绿而删除付费闭环断言。

- [ ] **Step 7：提交任务 3**

运行：

```bash
git add scripts/verify-blockers.mjs scripts/mjs-modules.d.ts
git commit -m "fix: load env provider evidence for blocker verification"
```

如果 `scripts/mjs-modules.d.ts` 没变化，不要加入。

---

## 任务 4：同步文档口径

**Files:**
- 修改：`docs/API_TEST_STATUS.md`
- 修改：`docs/IMPLEMENTATION_PLAN.md`
- 修改：`docs/DEVELOPMENT_SPEC.md`
- 修改：`docs/TECHNICAL_ARCHITECTURE.md`
- 修改：`docs/verification/backend-api-blockers.md`
- 修改：`docs/verification/model-route-audit-2026-06-12.md`
- 按需修改：`docs/API_FLOW.md`

- [ ] **Step 1：搜索旧口径**

运行：

```bash
rg -n "route snapshot|model_route_id|route_snapshot|videoRouteLogCount|DB route|model_routes/provider_keys|不默认生成音频|不要默认生成音频" docs
```

预期：会找到历史和当前引用。历史记录可以保留，但必须明确是历史，不得作为当前验收标准。

- [ ] **Step 2：更新 blocker 文档**

在 `docs/verification/backend-api-blockers.md` 中确保 paid delivery 证据写明：

```markdown
- `video_segments.provider/model` 包含 `apimart` / `pixverse-v6`
- `provider_call_logs.provider/model` 包含 `apimart` / `pixverse-v6`
- 不要求 `provider_call_logs.model_route_id` 或 `route_snapshot`，因为公开视频生成运行时已经改为 env-only。
```

- [ ] **Step 3：更新 model route audit 文档**

在 `docs/verification/model-route-audit-2026-06-12.md` 中确保当前结论写明：

```markdown
当前 env-only 方案下，paid delivery 样本走 APIMart/PixVerse 的依据来自环境变量、`video_segments.provider/model` 和 `provider_call_logs.provider/model`，不是 route snapshot。
```

如果文档仍说 `verify:blockers` 当前要求 route snapshot，改掉。

- [ ] **Step 4：更新 API 测试状态**

在 `docs/API_TEST_STATUS.md` 最新区域增加：

```markdown
### 2026-06-14 Env-only blocker verifier alignment

- `verify:blockers` paid delivery 证据改为检查 `video_segments.provider/model` 与 `provider_call_logs.provider/model`。
- 不再要求 `provider_call_logs.model_route_id` / `route_snapshot`。
- 付费闭环断言未降低：仍要求 `credit_cost > 0`、`reserve`、`capture`、final video 和 QA frames。
```

- [ ] **Step 5：更新实现计划快照**

在 `docs/IMPLEMENTATION_PLAN.md` 当前快照中确保写明：

```markdown
- `verify:blockers` 当前要求 paid delivery provider/model 证据来自 `video_segments.provider/model` 与 `provider_call_logs.provider/model`，不再要求 route snapshot。
```

- [ ] **Step 6：清理 DEVELOPMENT_SPEC 音频旧口径**

如果 `docs/DEVELOPMENT_SPEC.md` 中有：

```markdown
- 不默认生成音频。
```

替换为：

```markdown
- 免费试用默认无音频；付费默认生成音频；更高分辨率有声档不公开售卖。
```

并确保视频生成相关段落表达：

```markdown
- 免费试用：低分辨率、带水印、无音频。
- 付费默认：高分辨率、无水印、包含音频。
```

- [ ] **Step 7：更新技术架构**

在 `docs/TECHNICAL_ARCHITECTURE.md` 确保有当前运行时说明：

```markdown
MVP 公开视频生成 provider/model/key 只由环境变量决定。数据库 `model_routes` / `provider_keys` 不决定公开视频生成链路。
```

- [ ] **Step 8：最终文档残留扫描**

运行：

```bash
rg -n "provider_call_logs\\.model_route_id.*必须|route_snapshot.*必须|必须.*route_snapshot|不默认生成音频|不要默认生成音频|videoRouteLogCount" docs
```

预期：没有当前规范性命中。历史计划里如保留旧词，必须在同段明确“历史记录/已被 env-only 取代”。

- [ ] **Step 9：提交任务 4**

运行：

```bash
git add docs/API_TEST_STATUS.md docs/IMPLEMENTATION_PLAN.md docs/DEVELOPMENT_SPEC.md docs/TECHNICAL_ARCHITECTURE.md docs/verification/backend-api-blockers.md docs/verification/model-route-audit-2026-06-12.md docs/API_FLOW.md
git commit -m "docs: align blocker docs with env video config"
```

如果 `docs/API_FLOW.md` 没改，不要加入。

---

## 任务 5：清理小代码噪音与 generated 文件

**Files:**
- 修改：`src/lib/providers/apimart/video.ts`
- 检查：`next-env.d.ts`

- [ ] **Step 1：删除 APIMart 360p 注释**

在 `src/lib/providers/apimart/video.ts` 删除：

```ts
    //resolution: "360p",
```

不要改变实际行为：

```ts
resolution: input.resolution ?? "540p",
audio: input.audio ?? false,
```

- [ ] **Step 2：处理 `next-env.d.ts`**

运行：

```bash
git diff -- next-env.d.ts
```

如果唯一 diff 是：

```diff
-import "./.next/dev/types/routes.d.ts";
+import "./.next/types/routes.d.ts";
```

先恢复：

```bash
git checkout -- next-env.d.ts
```

因为本计划不需要修改 Next 生成类型引用。

如果后续 `npm run typecheck` 或 `npm run build` 明确因为该文件失败，再恢复 `.next/types` 引用，并在最终报告说明原因。

- [ ] **Step 3：跑 provider focused tests**

运行：

```bash
npx vitest run src/lib/providers/apimart/video.test.ts src/lib/providers/video-generation/router.test.ts
```

预期：通过。

- [ ] **Step 4：提交任务 5**

如果只删除 APIMart 注释：

```bash
git add src/lib/providers/apimart/video.ts
git commit -m "chore: remove stale pixverse resolution comment"
```

如果确实必须提交 `next-env.d.ts` 才能通过 build/typecheck：

```bash
git add src/lib/providers/apimart/video.ts next-env.d.ts
git commit -m "chore: clean pixverse config noise"
```

最终报告必须说明为什么提交 `next-env.d.ts`。

---

## 任务 6：全量验证

**Files:** 无预期源码改动。

- [ ] **Step 1：Typecheck**

运行：

```bash
npm run typecheck
```

预期：exit 0。

- [ ] **Step 2：全量测试**

运行：

```bash
npm test
```

预期：exit 0。记录 test files 和 tests 数量。

- [ ] **Step 3：Build**

运行：

```bash
npm run build
```

预期：exit 0。

- [ ] **Step 4：Blocker 验证**

运行：

```bash
npm run verify:blockers -- --json
```

预期：

- DB/env 配置完整且真实证据存在时：`passed = true`。
- DB/env 缺失时：输出真实缺失原因。
- 真实证据缺失时：输出 paid/failure/audit 证据缺失原因。
- 不能再出现 route snapshot 缺失。

- [ ] **Step 5：脚本残留扫描**

运行：

```bash
rg -n "provider call route snapshot|videoRouteLogCount|video_route_log_count|model_route_id is not null|route_snapshot is not null" scripts
```

预期：active verifier 无命中。

- [ ] **Step 6：工作区检查**

运行：

```bash
git status --short --branch
```

预期：没有未提交业务文件；不能有 `.env.local`；`next-env.d.ts` 状态必须已明确处理。

---

## 任务 7：可选真实 smoke 留痕

只有在 session 具备真实数据库、R2、APIMart、Cloud Run 和可用 paid job id 时执行。

**Files:**
- 修改：`docs/API_TEST_STATUS.md`
- 按需修改：`docs/verification/backend-api-blockers.md`

- [ ] **Step 1：跑 paid backend smoke**

运行：

```bash
npm run smoke:backend -- --job-id <new-paid-env-only-job-id>
```

预期：

- job 是 `deliverable`
- `credit_cost > 0`
- final video 存在
- QA frames 存在
- paid job 有 `reserve` / `capture`

- [ ] **Step 2：跑 blocker 验证**

运行：

```bash
npm run verify:blockers -- --json
```

预期：如果 paid delivery、failure compensation、audit evidence 都存在，应通过。

- [ ] **Step 3：记录 smoke 证据**

在 `docs/API_TEST_STATUS.md` 添加：

```markdown
### 2026-06-14 Env-only paid smoke

- Paid delivery job id: `<job-id>`
- Command: `npm run smoke:backend -- --job-id <job-id>`
- `credit_cost`: `<value>`
- `credit_ledger`: `reserve`, `capture`
- `video_segments.provider/model`: `apimart` / `pixverse-v6`
- `provider_call_logs.provider/model`: `apimart` / `pixverse-v6`
- final video key: `<key>`
- cover key: `<key or null>`
- QA frame count: `<count>`
- `npm run verify:blockers -- --json`: `<passed/blocked with reason>`
```

如果没有真实 smoke，不要编造这一段。

- [ ] **Step 4：提交 smoke 文档**

运行：

```bash
git add docs/API_TEST_STATUS.md docs/verification/backend-api-blockers.md
git commit -m "docs: record env video smoke evidence"
```

如果没有跑真实 smoke，跳过任务 7，并在最终报告说明阻塞条件。

---

## 最终交付要求

新 session 必须反馈：

- 创建的 commit 列表。
- 实际运行的命令。
- 每个命令的 pass/fail 摘要。
- `next-env.d.ts` 是恢复了，还是有明确原因地提交了。
- `npm run verify:blockers -- --json` 是否通过。
- 如果 `verify:blockers` 失败，给出具体失败 check 和 reason。
- 如果跑了真实 smoke，给出 paid job id 和关键证据。

不得声称 MVP blocker closure，除非同时满足：

- `npm run verify:blockers -- --json` 通过。
- paid delivery 证据包含 `video_segments` 和 `provider_call_logs` 的 provider/model。
- failure compensation 证据存在。
- audit evidence 存在。
