# Backend/API Hardening SPEC

**日期：** 2026-06-11

**目标：** 在 Creem 真实支付验证后置的前提下，把当前后台/API 从“主要链路能跑”推进到“付费任务、失败补偿、权限审计、Provider 运维和验收留痕都可上线前复核”的 MVP 加固状态。

**相关文档：**

- `docs/PRD.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_SPEC.md`
- `docs/API_FLOW.md`
- `docs/API_TEST_STATUS.md`
- `docs/superpowers/plans/2026-06-09-mvp-closure-next-steps.md`
- `docs/superpowers/specs/2026-06-11-admin-ops-closure-spec.md`

---

## 1. 背景与判断

当前项目已经完成了大量后台/API 工作：

- Cloud Run `stitch-worker` 已完成真实 smoke。
- 0 成本试用任务已经跑到 `deliverable`。
- Post-QA 已具备真实状态流转、provider call log、capture/release 结算能力。
- `/admin/jobs`、`/admin/jobs/[id]`、Provider、Template、Billing 页面和敏感操作 reason/audit 已落地。
- 用户侧核心 API、内部 worker API、后台 API 大多已实现。

但这还不能视为“可上线 MVP”。目前最危险的不是缺接口，而是容易把“接口存在”误判为“商业闭环可靠”。

当前必须承认的缺口：

- 付费任务 `credit_cost > 0` 的真实 `reserve -> capture` 还未验收。
- `failed_released / failed_refunded` 的真实补偿路径还未演练。
- 运维动作写入 `admin_audit_logs` 已有自动化覆盖，但缺后台查询和真实库留痕。
- Provider key 目前只支持状态更新，缺新增/轮换加密写入的后台/API 闭环。
- pricing/credit package 当前来自代码配置，缺后台可见的价格来源和上线风险提示。
- Creem checkout/webhook 真实验证后置，但代码仍必须完成审查、签名、幂等和“不得假成功”复核。

一句话：下一阶段不是继续堆功能，而是补“上线前不能自欺欺人”的硬验收面。

---

## 2. 当前阶段范围

### 2.1 本阶段必须做

1. 付费任务账务闭环验收工具化
   - 支持选择或创建 `credit_cost > 0` 的任务跑 full smoke。
   - full smoke 必须校验 `reserve`、`capture`、最终 `deliverable`、R2 成片和 QA frames。
   - 16 秒和 24 秒任务必须覆盖多 segment 情况。

2. 失败补偿路径验收工具化
   - 能演练或最小化模拟 provider/segment 失败、stitch 失败、Post-QA 失败后的释放/退款路径。
   - 失败任务不得遗留冻结点数。
   - `job_state_events`、`credit_ledger`、`video_jobs.status` 必须能对上。

3. 后台审计查询闭环
   - 新增 `GET /api/admin/audit-logs`。
   - 新增 `/admin/audit-logs` 页面。
   - 支持按 actor、action、targetType、targetId 查询。
   - 页面展示 reason、before/after 摘要、IP、user agent、createdAt。

4. Provider key 新增/轮换 API
   - 新增服务层能力，支持创建 provider key。
   - API 只接收明文 key，服务端加密后写入 `encrypted_key`。
   - 后台和 API 永远不返回完整 key。
   - 必须写 `keyPreview`，例如 `sk-...abcd`。
   - 新增/轮换必须填写 reason 并写 audit。

5. Pricing / credit package 后台可见化
   - 新增后台只读页面或扩展 billing 页面，展示当前 `creditPackages` 配置。
   - 明确标注来源是代码配置，Creem 真实产品 ID 待申请后复核。
   - 不在当前阶段实现复杂后台改价，避免价格和 Creem 产品不同步。

6. Creem 代码审查与安全测试
   - checkout 未配置 key 时不能返回伪造 URL。
   - checkout 只能使用站内点数包，不能让前端传任意金额。
   - webhook 必须验签。
   - webhook 必须按 external event/order 幂等。
   - 重放 webhook 不重复充值。
   - 真实 Creem 账号验证后置，但代码路径必须可测试。

7. API 权限和幂等复核
   - 用户只能访问自己的 job/file/ledger。
   - internal API 必须校验 secret。
   - admin/operator 权限边界测试补齐。
   - 重复 worker tick、重复 stitch callback、重复 post-QA resolve 不得重复扣费。

8. 文档验收留痕
   - 更新 `docs/API_TEST_STATUS.md`。
   - 更新 `docs/API_FLOW.md` 中当前仍过期的运维边界描述。
   - 记录哪些项已真实跑、哪些项因 Creem 申请未通过后置。

### 2.2 本阶段不做

- 不做 Creem 真实支付验收。
- 不做 Creem mock 支付成功链路。
- 不做复杂经营大屏。
- 不做批量 SKU。
- 不扩展模板库。
- 不做订阅/月付。
- 不做用户选择模型。
- 不绕过 Creem Moderation。
- 不允许管理员把未通过 Post-QA 的任务直接改成 `deliverable`。
- 不做后台直接编辑价格并同步 Creem 产品。

---

## 3. 详细功能 SPEC

### 3.1 付费任务账务闭环

当前 `docs/API_TEST_STATUS.md` 已记录一个 `credit_cost = 0` 的试用任务成功样本。下一步必须拿 `credit_cost > 0` 的任务证明账务闭环。

验收要求：

- 任务确认分镜后写入 `credit_ledger.reserve`。
- 钱包 `availableBalance` 减少，`reservedBalance` 增加。
- Post-QA 通过前，用户不能下载最终视频。
- Post-QA 通过后写入 `credit_ledger.capture`。
- 钱包 `reservedBalance` 减少，`totalCaptured` 增加。
- 最终 `video_jobs.status = deliverable`。
- R2 存在 `jobs/{jobId}/stitched/final.mp4`。
- R2 存在 `jobs/{jobId}/qa/frames/*.jpg`。
- `job_state_events` 能看到关键状态推进。

必须覆盖：

- 8 秒付费任务。
- 16 秒付费任务。
- 24 秒付费任务。

如果真实视频生成成本暂时不适合连续跑 16/24 秒，可以先完成工具和脚本，并在 `docs/API_TEST_STATUS.md` 中明确标注“代码路径已具备，真实 16/24 付费 smoke 待成本窗口执行”。但 8 秒付费任务必须尽快跑通。

### 3.2 失败补偿闭环

失败路径不能靠想象。必须证明任务失败时点数不会冻结到天荒地老。

验收要求：

- segment/provider 失败时：
  - 任务进入可解释失败态或可重试态。
  - 若确认不可交付，写入 `release` 或 `refund`。
  - 不出现 reserve 悬挂。

- stitch 失败时：
  - `stitch_jobs.last_error` 有错误摘要。
  - `video_jobs.status` 不进入 `deliverable`。
  - 后台能看到失败 stitch job。
  - 重试动作必须写 audit。

- Post-QA 失败时：
  - 不执行 `capture`。
  - 进入 `failed_released` 或 `failed_refunded`。
  - `credit_ledger.release/refund` 与 job 状态一致。

- moderation 阻断时：
  - `flag`、`deny`、`error` 都阻断。
  - 不创建或不提交 segment。
  - 不冻结点数。
  - 保存 `prompt_moderation_results`。

### 3.3 Admin audit logs 查询

当前审计写入能力已有，但上线前需要后台可查。

新增 API：

```text
GET /api/admin/audit-logs
```

查询参数：

- `actorEmail`
- `action`
- `targetType`
- `targetId`
- `limit`

默认行为：

- 默认返回最近 50 条。
- `limit` 最大 100。
- 按 `createdAt desc` 排序。
- 仅 admin 可查看完整审计；operator 默认不能查看 provider/model route 相关审计。

新增页面：

```text
/admin/audit-logs
```

页面展示：

- createdAt
- actorEmail
- action
- targetType
- targetId
- reason
- ipAddress
- userAgent
- beforeSnapshot 摘要
- afterSnapshot 摘要

安全约束：

- 不展示完整 provider key。
- 不展示完整用户敏感 prompt。
- snapshot 里如果出现疑似 key 字段，必须做脱敏。

### 3.4 Provider key 新增/轮换

当前 Provider 页面能看 key 和更新状态，但不能新增/轮换。MVP 上线前至少需要管理员安全轮换 key 的能力。

新增服务能力：

- `createProviderKey`
- `rotateProviderKey`

输入字段：

- `providerId`
- `label`
- `environment`
- `plainKey`
- `dailyCostLimit`
- `concurrentLimit`
- `status`
- `reason`

输出字段：

- `id`
- `providerId`
- `label`
- `environment`
- `status`
- `keyPreview`
- `dailyCostLimit`
- `concurrentLimit`
- `failureCount`
- `createdAt`
- `updatedAt`

不得输出：

- `plainKey`
- `encryptedKey`

加密要求：

- 复用或新增一个 provider key encryption helper。
- 如果当前项目没有 KMS，MVP 可使用环境变量对称加密，例如 `PROVIDER_KEY_ENCRYPTION_SECRET`。
- 未配置 encryption secret 时，创建/轮换 key 必须失败，不能明文落库。
- `keyPreview` 只能保存前后少量字符，例如 `sk-...abcd`。

权限要求：

- 只有 `admin` 可以新增/轮换 provider key。
- `operator` 只能暂停/恢复 key，不能看到或写入完整 key。
- 所有新增/轮换/状态更新都必须写 `admin_audit_logs`。

API 建议：

```text
POST /api/admin/provider-keys
POST /api/admin/provider-keys/[id]/rotate
```

### 3.5 Pricing / credit package 可见化

当前 `src/lib/credits/packages.ts` 是点数包来源。因为 Creem 真实产品申请还没完成，本阶段不做后台改价，避免站内价格和 Creem 产品 ID 不一致。

要求：

- 后台 Billing 页面展示当前点数包：
  - code
  - name
  - amountCents
  - currency
  - credits
  - creemProductId
- 页面明确提示：
  - “当前点数包来自代码配置。”
  - “Creem 产品 ID 和真实 checkout 待 Creem 账号通过后复核。”
- `POST /api/billing/checkout` 仍只能使用这些站内点数包。
- 前端不得传金额或 credits。

### 3.6 Creem 代码审查

Creem 真实验证后置，但不能后置代码安全审查。

必须复核：

- `src/lib/providers/creem/client.ts`
- `src/lib/providers/creem/webhook.ts`
- `src/lib/providers/creem/moderation.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/webhooks/creem/route.ts`

验收要求：

- 未配置 `CREEM_API_KEY` 时 checkout 返回 provider unavailable。
- checkout 请求体不能接受用户自定义价格。
- checkout 创建失败不创建假订单。
- webhook 缺签名拒绝。
- webhook 签名错误拒绝。
- webhook 重放不重复写 purchase。
- webhook 对未知 order/event 返回可解释错误。
- Creem Moderation API 失败时 fail closed。

### 3.7 API 权限和幂等

用户侧必须补齐或复核：

- `GET /api/jobs/[id]` 只能 owner 访问。
- `GET /api/jobs/[id]/progress` 只能 owner 访问。
- `GET /api/jobs/[id]/download` 只能 owner 且状态 `deliverable` 访问。
- `GET /api/files/signed-url` 只能 owner 或 admin 访问。
- `GET /api/billing/overview` 只能当前用户访问自己的钱包和流水。

内部 API 必须补齐或复核：

- `/api/internal/worker/tick` 校验 `CRON_JOB_SECRET`。
- `/api/internal/segments/[id]/submit` 校验 `INTERNAL_WORKER_SECRET`。
- `/api/internal/segments/[id]/poll` 校验 `INTERNAL_WORKER_SECRET`。
- `/api/internal/stitch/jobs` 校验 `INTERNAL_WORKER_SECRET`。
- `/api/internal/stitch/callback` 校验 Cloud Run/internal secret。
- `/api/internal/post-qa/resolve` 幂等，不重复 capture/release。

后台 API 必须补齐或复核：

- `operator` 不可新增/轮换 provider key。
- `operator` 不可修改 model route。
- `admin` 可执行 provider/model route 管理。
- 所有敏感操作 reason 至少 6 字符。

### 3.8 Health check 与文档

`GET /api/health` 应能区分：

- database
- auth
- storage
- internalSecurity
- stitchWorker
- billing
- aiProviders
- moderation
- creemPayment

Creem payment 可以是 `pending`，但 moderation 不应被同样后置。如果 moderation key 缺失，生成链路必须不可用。

文档要求：

- `docs/API_TEST_STATUS.md` 记录本轮执行命令、job id、账本结果、失败补偿结果、未验收原因。
- `docs/API_FLOW.md` 更新“管理台 UI 还没做”等过时描述。
- Creem 真实支付验收项标记为 pending Creem approval，不写“已通过”。

---

## 4. 测试要求

必须新增或更新测试：

- `scripts/lib/backend-smoke-utils.test.ts`
  - `credit_cost > 0` 时要求 `reserve` 和 `capture`。
  - `credit_cost = 0` 时不要求 capture。
  - 缺少 `credit_cost` 时 full smoke 失败。

- `src/server/admin/audit.test.ts`
  - 审计查询过滤。
  - snapshot 脱敏。

- `src/app/api/admin/audit-logs/route.test.ts`
  - admin 可查询。
  - operator 权限受限。
  - 普通用户拒绝。

- `src/server/admin/providers.test.ts`
  - admin 可创建 provider key。
  - operator 不可创建 provider key。
  - 未配置 encryption secret 时失败。
  - 返回结果不包含 encrypted/plain key。
  - 创建/轮换写 audit。

- `src/app/api/admin/provider-keys/route.test.ts`
  - reason 缺失拒绝。
  - key 明文不出现在响应。

- `src/app/api/admin/provider-keys/[id]/rotate/route.test.ts`
  - admin 可轮换。
  - operator 拒绝。
  - reason 缺失拒绝。

- `src/app/api/billing/checkout/route.test.ts`
  - 不接受任意金额。
  - 未配置 Creem key 不伪造 URL。

- `src/app/api/webhooks/creem/route.test.ts`
  - 缺签名拒绝。
  - 错签名拒绝。
  - 重放不重复充值。

- 用户权限相关 route tests
  - 非 owner 访问 job/progress/download/file 失败。
  - 未 deliverable 下载失败。

---

## 5. 手工验收清单

本阶段完成后，必须至少执行以下验收：

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run smoke:stitch`
- `npm run smoke:backend -- --job-id <credit_cost_gt_0_job_id>`

真实环境验收记录必须包含：

- 日期。
- job id。
- duration。
- aspect ratio。
- credit cost。
- final `video_jobs.status`。
- final video R2 key。
- QA frame R2 keys。
- `credit_ledger.reserve`。
- `credit_ledger.capture`。
- 如果失败，记录 `release/refund`。
- 如果 Creem 支付未验证，写 pending Creem approval。

---

## 6. 完成定义

本阶段完成的标准：

- 至少一个 `credit_cost > 0` 的任务完成 full smoke，并证明 `reserve -> capture`。
- 失败补偿路径有自动化测试和至少一个真实/半真实演练记录。
- 后台可查询 audit logs。
- Provider key 可新增/轮换，且不泄露明文。
- Billing 后台可见点数包配置和 Creem pending 状态。
- Creem checkout/webhook/moderation 代码审查测试通过。
- 权限和幂等关键测试通过。
- `docs/API_TEST_STATUS.md` 和 `docs/API_FLOW.md` 已更新。

未完成的标志：

- 只看到接口 200，但没有账本/R2/状态机证据。
- 付费任务没有 `capture`。
- 失败任务有冻结点数悬挂。
- 审计日志只能写不能查。
- Provider key 明文出现在响应或页面。
- Creem checkout 可以伪造成功。
- Post-QA 通过前用户能下载。

