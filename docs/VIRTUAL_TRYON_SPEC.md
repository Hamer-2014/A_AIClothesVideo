# AI 模特虚拟试穿 SPEC

版本：v1 静态定妆包  
日期：2026-08-01  
关联：[PRD](PRD.md)、[技术架构](TECHNICAL_ARCHITECTURE.md)、[开发 SPEC](DEVELOPMENT_SPEC.md)

## 1. 产品范围

本模块是独立的静态 AI 模特试穿入口：用户上传已授权商品图，平台以 APIMart `gpt-image-2` 在平台配置模特上生成可下载的 `appearance pack`。它不是已验证的专业 VTON，前台不得承诺版型、材质、人体或跨视角绝对保真。

仅支持两个互斥模式：

| mode | 必须商品输入 | required views | 生成顺序 | 锁定条件 |
| --- | --- | --- | --- | --- |
| `front_only` | `front` | `front` | front | front 已 R2 转存且单视角 Strict QA pass |
| `three_view` | `front` + `back` + `detail` | `front`, `side`, `back` | front -> side -> back | 三张均 R2 转存且所有单视角/跨视角 Strict QA pass |

`three_view` 不接受缺 back 或缺 detail；这种输入只能创建 `front_only`，绝不生成部分三视图 pack。side 是生成目标而非用户输入。第一版不实现视频动作、Flow Music、Cloud Run 混音、24/32/40 秒视频、场景、跑步、舞蹈或 360。详情页的“继续生成视频”仅返回 bridge 契约与“尚未启用”状态，绝不创建视频任务或伪造成功。

## 2. 用户、授权与资产协议

前台入口 `GET /virtual-try-on`，详情 `GET /virtual-try-on/[id]`；未登录跳到 `/login?next=/virtual-try-on`。`POST /api/virtual-try-on` 的 body 为：

```ts
type CreateVirtualTryOnRequest = {
  mode: "front_only" | "three_view";
  skuName?: string;
  sourceAssetIds: { front: string; back?: string; detail?: string };
};
```

客户端先复用 `POST /api/assets/attest-rights`，请求 `assetIds` 和 `{ accepted: true, version: "image_rights_v1" }`。创建服务复用 `parseRightsAttestation` / `attestAssets`（`src/server/compliance/rights-attestation.ts`）和 `assets`/`asset_rights_attestations`：每个 source asset 必须为当前 user owner、`status="uploaded"` 或 `"ready"`、未删除、拥有当前 `image_rights_v1` 链接，且 role 分别为 `front/back/detail`。job 写不可变 `rightsSnapshot`（asset id、original key、attestation id/version、acceptedAt），而生成 asset 是 `derived`，从不调用用户权利声明或伪装成上传真人。

平台模特参考是私有 R2 key：`VIRTUAL_TRYON_MODEL_FRONT_KEY`、`VIRTUAL_TRYON_MODEL_SIDE_KEY`、`VIRTUAL_TRYON_MODEL_BACK_KEY`。worker 用 `createDownloadSignedUrl({ key, expiresIn: 300 })` 临时 presign；key 可保存于 job 的 model snapshot，signed URL 永远不得进入数据库、`provider_call_logs`、事件、错误消息或日志。任一 key、`APIMART_API_KEY`、现有 R2 配置、Creem moderation 配置缺失时 fail closed；前台文案为“试穿服务暂不可用，请稍后再试”，不 mock 成功。

## 3. 计费与审核

这是收费链路，复用 `reserveCredits`、`captureReservedCredits`、`releaseReservedCredits` 与 idempotency key（`src/lib/credits/ledger.ts`）。价格为正整数 env：`VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST` 与 `VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST`；缺失、零或非法值导致配置不可用，不降级免费。

创建前根据固定服务 prompt 调用 `checkPrompt`（`src/server/moderation/check-prompt.ts`），`source` 新增 `virtual_tryon_generation`；Creem decision `flag`、`deny`、`error` 全部阻断，且在 reserve 前发生。审核 allow 后，在同一 create transaction 中插入 job/pack/state event 并 reserve：`idempotencyKey="virtual-tryon:{jobId}:reserve"`。只有 APIMart、R2 转存和 Strict QA 全部完成、pack 已 ready 后才 capture：`"virtual-tryon:{jobId}:capture"`。任何 ready 前终态失败（供应商、R2、schema、QA 或重试耗尽）以 `"virtual-tryon:{jobId}:release"` release；供应商失败成本由产品毛利承担。capture 后如果锁定或下载的内部故障使用户不能交付，则以 `"virtual-tryon:{jobId}:refund"` refund。重复 create/tick 由 ledger 幂等键和 job/view 唯一索引防双扣。

## 4. Provider、R2 与重试

每个 view 用 `POST {APIMART_BASE_URL}/v1/images/generations`，body 固定为：

```ts
{ model: "gpt-image-2", n: 1, prompt, image_urls: orderedUrls }
```

`orderedUrls` 不超过 16，顺序是当前 view 的临时模特 reference，然后 `front`、在 `three_view` 下依次 `back`、`detail`。`GET /v1/tasks/{task_id}` 只轮询该 view。provider 任务和输出 URL 可在进程内暂存；输出 URL 一到达立即 `transferRemoteObjectToR2`，写 key `virtual-tryon/{jobId}/packs/{packId}/{view}.png`。系统不保存远程 URL。

失败分类：配置/rights/moderation/response-schema/QA `unknown` 为不可重试且 fail closed；网络超时、429、5xx、明确 queued/running poll 为可重试；4xx（非 429）、provider failed、无 output URL 为不可重试。每 view 记录 `attemptCount`、`providerTaskId`、`providerStatus`、`r2Key`、`lastErrorCode`、`nextRetryAt`；默认最多 2 次提交尝试，指数退避 30s/120s。provider call log 的 request snapshot 仅含 `imageCount`、`view`、prompt hash；response summary 仅含 task/status/cost，不含输入 signed URL、raw output URL 或 raw response。

## 5. 数据、状态机与幂等

新增 `virtual_tryon_jobs`（owner、mode、status、source/model/rights snapshot、pack id、creditCost、reserve/capture ledger id、lock fields）、`appearance_packs`（job、version、requiredViews、status、lockedAt）、`appearance_pack_assets`（pack、view、providerTaskId/status、attemptCount、r2Key、origin/provenance） 、`garment_fidelity_results`、`virtual_tryon_state_events`。唯一键：`appearance_packs(job_id, version)`、`appearance_pack_assets(pack_id, view)`、`garment_fidelity_results(pack_id, scope, view)`、`virtual_tryon_jobs(user_id, create_idempotency_key)`。

| from | worker action | to | 每 tick 的原子边界 |
| --- | --- | --- | --- |
| `draft` | 检查配置/asset/rights，moderate，再 reserve | `queued` | create 只到这里，不调用 APIMart |
| `queued` | 提交首个未提交 required view | `generating` | 只写一个 view task id |
| `generating` | poll 一个最早未完成 view；成功时转存 R2 | `queued` 或 `qa_queued` | 只处理一个 view；前序完成后才提交后序 |
| `qa_queued` | 单视角与跨视角 QA，随后 capture reserved credits | `ready` | QA 全 pass 且 capture 成功才 ready |
| `ready` | 用户 lock | `locked` | locked pack 永不覆盖 |
| `queued/generating/qa_queued` | 不可恢复或重试耗尽 | `failed_released` | 所有 ready 前失败 release reserve |
| `ready/locked` | 平台内部交付故障 | `failed_refunded` | 已 capture 时 refund |

内部 `POST /api/internal/virtual-try-on/tick` 复用 `CRON_JOB_SECRET` 的 Bearer/x-cron-secret 检查，body `{ limit?: number }`，成功返回 `{ processed, submitted, polled, ready, failed }`。专用 lock store 使用同一 compare-and-set 策略，锁 60 秒；同一 tick 只能推进一个 job 的一个状态或一个 view，重复 tick 读取已有 `providerTaskId`，绝不重复提交。`

## 6. Strict QA JSON 契约

`src/server/virtual-tryon/qa-schema.ts` 定义并校验：

```ts
type StrictViewQa = {
  verdict: "pass" | "fail" | "unknown";
  targetView: "front" | "side" | "back";
  garment: { silhouette: "match" | "mismatch" | "unknown"; color: "match" | "mismatch" | "unknown"; pattern: "match" | "mismatch" | "unknown"; visibleDetails: "match" | "mismatch" | "unknown" };
  person: { anatomy: "natural" | "abnormal" | "unknown"; identityConsistency: "match" | "mismatch" | "unknown" };
  inventedDetails: boolean | null;
  evidence: string[];
};
type StrictCrossViewQa = { verdict: "pass" | "fail" | "unknown"; requiredViews: ("front" | "side" | "back")[]; coverage: "complete" | "incomplete" | "unknown"; garmentConsistency: "match" | "mismatch" | "unknown"; personConsistency: "match" | "mismatch" | "unknown"; evidence: string[] };
```

单视图 pass 要求每个 garment field `match`、anatomy `natural`、identity `match`、`inventedDetails=false`；跨视图 pass 要求 complete/match/match。任何 schema failure、provider failure、`unknown`、`fail` 均 fail closed。确切文件：`src/server/virtual-tryon/qa-schema.ts`、`qa.ts`、`qa-schema.test.ts`、`qa.test.ts`、`service.ts`、`service.test.ts`。

## 7. API、UI、后台与文案

| 路径 | 方法/鉴权 | 请求 | 响应 |
| --- | --- | --- | --- |
| `/api/virtual-try-on` | POST/session owner | CreateVirtualTryOnRequest + `Idempotency-Key` | 201 `{ jobId, status:"queued", packId }`；400 input/rights，402 credits，409 duplicate，503 unavailable |
| `/api/virtual-try-on/[id]` | GET/session owner | 无 | `{ id, mode, status, pack, views, videoBridge }`；404 防枚举 |
| `/api/virtual-try-on/[id]/lock` | POST/session owner | `{ packId }` | `{ packId, status:"locked", lockedAt }`；409 非 ready/旧 pack |
| `/api/virtual-try-on/[id]/assets/[assetId]/download` | GET/session owner | 无 | 302 short R2 URL；404 非 owner/非 ready-locked/非 pack asset |
| `/api/internal/virtual-try-on/tick` | POST/cron secret | `{ limit?: number }` | tick 计数；401/503 fail closed |

创建文件：`src/app/(dashboard)/virtual-try-on/page.tsx`、`page.test.tsx`、`src/app/(dashboard)/virtual-try-on/[id]/page.tsx`、`page.test.tsx`；组件 `src/components/virtual-try-on/create-form.tsx`、`create-form.test.tsx`、`pack-detail.tsx`、`pack-detail.test.tsx`；并修改 `src/components/dashboard/shell.tsx` 的调用处导航（`src/app/(dashboard)/workspace/page.tsx`）加入“虚拟试穿”。前台状态：配置缺失“试穿服务暂不可用”；排队“正在等待安全生成”；QA “正在核验服装与模特一致性”；failed “本次定妆未通过核验，未交付图片”；视频按钮“继续生成视频（即将推出）”。

后台新增 `GET /admin/virtual-try-on`、`GET /admin/virtual-try-on/[id]`，API `GET /api/admin/virtual-try-on`、`GET /api/admin/virtual-try-on/[id]`，使用 `getAdminSession`。列表显示 job id/owner/mode/status/pack version/required views/createdAt；详情再显示每 view task status/attempt/R2-key suffix、Strict verdict、provider/model、ledger 状态、失败 code、state events 和 provenance。实现文件为 `src/server/admin/virtual-tryon.ts`、`src/app/admin/virtual-try-on/page.tsx`、`src/app/admin/virtual-try-on/[id]/page.tsx` 与对应 tests；绝不显示 URL 或 API key。

## 8. 保留、指标、桥接与 smoke

source asset、rights snapshot、pack/provenance、QA、state event 和脱敏 provider log 按既有 retention/rights-removal 工作流保留；源资产删/撤权后 pack soft-delete、禁下载，并调度 R2 删除。指标为创建/配置/审核/扣款失败率，视角提交/轮询/R2/QA 成功率，ready/lock/download 转化，重试次数、成本、退款人工工单率。

桥接仅在 ready/locked 返回 `{ kind:"virtual_tryon_appearance_pack", appearancePackId, version, mode, assetIds, provenance:"generated_apimart_gpt_image_2", videoGeneration:"not_enabled" }`。真实 smoke 脚本为 `scripts/virtual-tryon-smoke.mjs`：先检查 `APIMART_API_KEY`、三项 `VIRTUAL_TRYON_MODEL_*_KEY`、`R2_*`、`DATABASE_URL`；任一缺失输出 `SKIP: virtual try-on staging smoke requires ...` 并 exit 0；齐备时只在 staging 创建 `front_only` isTest job，循环调用内部 tick 至 terminal，验证 R2 key 与 Strict pass，随后软删除。命令：`pnpm exec dotenv -e .env.staging -- node scripts/virtual-tryon-smoke.mjs`；未提供真实变量时不得声称执行过。
