# Rights Attestation and Takedown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有服务端素材上传建立可审计的权利声明，并提供公开、可限流、可后台处理的侵权删除入口，作为真人模特付费 Beta 的发布门槛。

**Architecture:** 将授权声明、资产关联和任务快照分别持久化，上传 Presign、Preflight 和任务创建形成三层服务端门禁。侵权通知使用独立的结构化案件服务，数据库受理成功后再做邮件通知；后台人工核验并审计状态变更，公开提交不会自动删除内容。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、Drizzle/Neon、Resend、better-auth、Cloudflare R2。

---

## 执行前提

- 先完成 `docs/superpowers/plans/2026-07-10-readme-development-environment.md`，复用其中的 `APP_ENV`、`ABUSE_HASH_SECRET` 和环境健康检查调整。
- 参考规格：`docs/superpowers/specs/2026-07-11-rights-attestation-takedown-design.md`。
- 用户已明确同意按建议在当前工作区内联执行；本计划不另建会丢失未提交基线的干净 worktree。
- 当前工作区已有用户对 `drizzle/meta/_journal.json`、`src/server/jobs/create-job.ts`、`src/server/jobs/preflight.ts`、`src/components/workspace/workspace-app.tsx` 等文件的未提交改动。禁止 reset、clean、stash 或覆盖这些改动。
- 迁移编号必须从执行当时 `drizzle/meta/_journal.json` 的最后一项继续生成，不得重写现有 `0014_admin_audit_target_id_text.sql`。
- 本计划完成并验收后，再执行 40 秒、商品旋转和真人模特转身计划。

## 文件职责

- Create `src/lib/db/schema/compliance.ts`: 权利声明、资产关联和侵权案件表。
- Modify `src/lib/db/schema/jobs.ts`: 保存任务级声明快照。
- Create `src/server/compliance/rights-attestation.ts`: 当前声明、解析、摘要和声明存储服务。
- Create `src/server/compliance/rights-removal.ts`: 投诉解析、去敏、限流和案件创建服务。
- Create `src/server/compliance/rights-removal-email.ts`: 固定模板的 Resend 通知。
- Create `src/server/compliance/retention.ts`: 三年到期记录去标识化。
- Modify upload Presign/Complete: 声明与资产事务写入，所有资产先 `pending_upload`。
- Create `POST /api/assets/attest-rights`: 历史资产补签。
- Modify Preflight/job creation: 缺少声明时阻断并保存任务快照。
- Create `GET /takedown` and `POST /api/compliance/rights-removal`: 公开投诉入口。
- Create admin rights-removal service/API/page: 人工核验、权限和审计。
- Modify legal/public pages, footer, health, env and core docs.

### Task 1: 建立合规数据模型与迁移

**Files:**
- Create: `src/lib/db/schema/compliance.ts`
- Modify: `src/lib/db/schema/jobs.ts`
- Modify: `src/lib/db/schema/index.ts`
- Modify: `src/lib/db/schema/index.test.ts`
- Create: next migration after the current Drizzle journal tail

- [ ] **Step 1: 先写失败的 Schema 导出测试**

在 `requiredTables` 加入三张表，并添加字段断言：

```ts
const requiredComplianceTables = [
  "rightsAttestations",
  "assetRightsAttestations",
  "rightsRemovalRequests",
] as const;

for (const tableName of requiredComplianceTables) {
  expect(schema[tableName]).toBeDefined();
}
expect(schema.videoJobs).toHaveProperty("rightsAttestationSnapshot");
expect(schema.rightsRemovalRequests).toHaveProperty("publicReference");
expect(schema.rightsRemovalRequests).toHaveProperty("resolutionSummary");
```

- [ ] **Step 2: 运行测试并确认因表不存在而失败**

```powershell
pnpm exec vitest run src/lib/db/schema/index.test.ts
```

Expected: FAIL，缺少 `rightsAttestations` 等导出。

- [ ] **Step 3: 创建合规 Schema**

`src/lib/db/schema/compliance.ts` 使用以下稳定枚举和表结构：

```ts
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, jsonSnapshot, timestamps } from "./common";

export const rightsAttestationScopeValues = [
  "upload",
  "generation_reconfirmation",
] as const;
export const rightsAttestationScopeEnum = pgEnum(
  "rights_attestation_scope",
  rightsAttestationScopeValues,
);

export const rightsRemovalStatusValues = [
  "received",
  "triaging",
  "awaiting_information",
  "action_required",
  "resolved_removed",
  "resolved_rejected",
] as const;
export const rightsRemovalStatusEnum = pgEnum(
  "rights_removal_status",
  rightsRemovalStatusValues,
);

export const rightsTypeValues = [
  "likeness",
  "copyright",
  "trademark",
  "privacy",
  "other",
] as const;
export const rightsTypeEnum = pgEnum("rights_type", rightsTypeValues);

export const rightsAttestations = pgTable("rights_attestations", {
  ...id,
  userId: text("user_id").notNull(),
  version: text("version").notNull(),
  statementSnapshot: text("statement_snapshot").notNull(),
  scope: rightsAttestationScopeEnum("scope").notNull(),
  locale: text("locale").notNull().default("zh-CN"),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  redactedAt: timestamp("redacted_at", { withTimezone: true }),
});

export const assetRightsAttestations = pgTable(
  "asset_rights_attestations",
  {
    ...id,
    assetId: uuid("asset_id").notNull(),
    rightsAttestationId: uuid("rights_attestation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("asset_rights_attestation_unique").on(
      table.assetId,
      table.rightsAttestationId,
    ),
  ],
);

export const rightsRemovalRequests = pgTable(
  "rights_removal_requests",
  {
    ...id,
    publicReference: text("public_reference").notNull(),
    status: rightsRemovalStatusEnum("status").notNull().default("received"),
    reporterName: text("reporter_name").notNull(),
    reporterEmail: text("reporter_email").notNull(),
    rightsType: rightsTypeEnum("rights_type").notNull(),
    contentReferences: jsonSnapshot("content_references").notNull().default([]),
    description: text("description").notNull(),
    goodFaithConfirmed: boolean("good_faith_confirmed").notNull(),
    accuracyConfirmed: boolean("accuracy_confirmed").notNull(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    resolutionSummary: text("resolution_summary"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    redactedAt: timestamp("redacted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rights_removal_public_reference_unique").on(
      table.publicReference,
    ),
  ],
);
```

`videoJobs` 加入：

```ts
rightsAttestationSnapshot: jsonSnapshot("rights_attestation_snapshot"),
```

从 `schema/index.ts` 导出 `./compliance`。

- [ ] **Step 4: 生成并检查迁移**

```powershell
pnpm db:generate
```

Expected: 只新增上述枚举、三张表、唯一索引和 `video_jobs.rights_attestation_snapshot`；不得 drop 或改名无关字段。

- [ ] **Step 5: 验证并提交 Schema**

```powershell
pnpm exec vitest run src/lib/db/schema/index.test.ts src/lib/db/migrations.test.ts
pnpm run typecheck
git add src/lib/db/schema/compliance.ts src/lib/db/schema/jobs.ts src/lib/db/schema/index.ts src/lib/db/schema/index.test.ts drizzle
git commit -m "feat: add rights compliance schema"
```

### Task 2: 实现权利声明领域服务与上传事务

**Files:**
- Create: `src/server/compliance/rights-attestation.ts`
- Create: `src/server/compliance/rights-attestation.test.ts`
- Modify: `src/app/api/uploads/presign/route.ts`
- Modify: `src/app/api/uploads/presign/route.test.ts`
- Modify: `src/app/api/uploads/complete/route.test.ts`

- [ ] **Step 1: 写声明解析与 fail-closed 失败测试**

```ts
import { describe, expect, it } from "vitest";

import {
  CURRENT_RIGHTS_ATTESTATION_VERSION,
  parseRightsAttestation,
  requireComplianceHashSecret,
} from "./rights-attestation";

describe("rights attestation", () => {
  it("accepts only the current actively accepted statement", () => {
    expect(
      parseRightsAttestation({
        accepted: true,
        version: CURRENT_RIGHTS_ATTESTATION_VERSION,
      }),
    ).toEqual({
      accepted: true,
      version: "image_rights_v1",
    });
  });

  it("rejects a missing acceptance", () => {
    expect(() => parseRightsAttestation({ accepted: false })).toThrow(
      "rights_attestation_required",
    );
  });

  it("rejects a stale statement version", () => {
    expect(() =>
      parseRightsAttestation({ accepted: true, version: "image_rights_v0" }),
    ).toThrow("rights_attestation_version_mismatch");
  });

  it("fails closed without a hash secret outside local development", () => {
    expect(() => requireComplianceHashSecret("production", "")).toThrow(
      "compliance_hash_secret_required",
    );
    expect(requireComplianceHashSecret("development", "")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试并确认模块缺失**

```powershell
pnpm exec vitest run src/server/compliance/rights-attestation.test.ts
```

Expected: FAIL with module-not-found。

- [ ] **Step 3: 实现常量、解析和 Store 合同**

```ts
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  assetRightsAttestations,
  assets,
  rightsAttestations,
} from "@/lib/db/schema";
import { hashAbuseSignal } from "@/server/abuse/hash";

export const CURRENT_RIGHTS_ATTESTATION_VERSION = "image_rights_v1" as const;
export const CURRENT_RIGHTS_ATTESTATION_STATEMENT =
  "我确认拥有或已获得上传素材的版权、商标及商业使用授权；如素材包含可识别人物，我已获得其肖像和商业宣传授权；如人物未满 18 周岁，我已获得其监护人授权。我不会将素材或生成结果用于冒充代言、色情化、政治宣传或其他违法误导用途。";

export type ParsedRightsAttestation = {
  accepted: true;
  version: typeof CURRENT_RIGHTS_ATTESTATION_VERSION;
};

export function parseRightsAttestation(value: unknown): ParsedRightsAttestation {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  if (record.accepted !== true) {
    throw new Error("rights_attestation_required");
  }
  if (record.version !== CURRENT_RIGHTS_ATTESTATION_VERSION) {
    throw new Error("rights_attestation_version_mismatch");
  }
  return { accepted: true, version: CURRENT_RIGHTS_ATTESTATION_VERSION };
}

export function requireComplianceHashSecret(
  appEnvironment: string,
  secret: string | null | undefined,
) {
  const normalized = secret?.trim() || null;
  if (!normalized && appEnvironment !== "development" && appEnvironment !== "test") {
    throw new Error("compliance_hash_secret_required");
  }
  return normalized;
}
```

定义 `RightsAttestationStore.createAttestationWithAssets`，输入一条声明和 1-8 个已验证上传描述，返回 `attestationId` 与创建的资产。Drizzle 实现必须使用 `db.transaction` 依次插入 `rightsAttestations`、全部 `assets(status="pending_upload")` 和全部 `assetRightsAttestations`；内存实现用于测试并暴露 `listAttestations()`、`listAssets()`、`listLinks()`。

- [ ] **Step 4: 先写上传路由失败测试**

在 `presign/route.test.ts` 添加：

```ts
it("requires the current rights statement before creating assets", async () => {
  const createAttestationWithAssets = vi.fn();
  const response = await handleUploadPresignRequest(
    new Request("http://localhost/api/uploads/presign", {
      method: "POST",
      body: JSON.stringify({
        files: [{
          fileName: "front.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
          intendedRole: "front",
        }],
      }),
    }),
    {
      getSession: async () => ({ user: { id: "user-1" } }),
      createAttestationWithAssets,
    },
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "rights_attestation_required",
  });
  expect(createAttestationWithAssets).not.toHaveBeenCalled();
});
```

添加成功用例，断言 `rightsAttestation.version === "image_rights_v1"`、请求元数据传入摘要服务、单文件和批量资产都为 `pending_upload`，签名响应不暴露 R2 key。

- [ ] **Step 5: 运行路由测试并确认现有路由错误地接受缺少声明的上传**

```powershell
pnpm exec vitest run src/app/api/uploads/presign/route.test.ts
```

Expected: 新用例 FAIL，当前返回 200 而不是 400。

- [ ] **Step 6: 将 Presign 改为事务服务**

请求解析后立即调用 `parseRightsAttestation(body.rightsAttestation)`。把原 `createAsset` 依赖替换为：

```ts
createAttestationWithAssets?: (input: {
  userId: string;
  attestation: ParsedRightsAttestation;
  scope: "upload";
  locale: string;
  ipAddress: string | null;
  userAgent: string | null;
  files: Array<{
    id: string;
    key: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    detectedRole: AssetRole;
    status: "pending_upload";
  }>;
}) => Promise<{
  attestationId: string;
  assets: Array<{ id: string; key: string }>;
}>;
```

先验证所有文件，再一次性创建声明和资产，然后逐个签发 URL。声明错误映射：required -> 400，version mismatch -> 409，hash secret missing -> 503。`/api/uploads/complete` 继续作为唯一把资产改为 `uploaded` 的入口。

- [ ] **Step 7: 运行并提交上传服务**

```powershell
pnpm exec vitest run src/server/compliance/rights-attestation.test.ts src/app/api/uploads/presign/route.test.ts src/app/api/uploads/complete/route.test.ts
pnpm run typecheck
git add src/server/compliance/rights-attestation.ts src/server/compliance/rights-attestation.test.ts src/app/api/uploads/presign/route.ts src/app/api/uploads/presign/route.test.ts src/app/api/uploads/complete/route.test.ts
git commit -m "feat: require rights attestation for uploads"
```

### Task 3: 在上传面板增加主动声明

**Files:**
- Modify: `src/components/workspace/upload-panel.tsx`
- Modify: `src/components/workspace/upload-panel.test.tsx`
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/components/workspace/workspace-app.test.tsx`

- [ ] **Step 1: 写未勾选、游客和请求体测试**

```tsx
function UploadPanelHarness({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [rightsAccepted, setRightsAccepted] = useState(false);
  return (
    <UploadPanel
      assets={[]}
      isAuthenticated={isAuthenticated}
      onRemoveUploaded={() => {}}
      onUploaded={() => {}}
      onUploadingChange={() => {}}
      rightsAccepted={rightsAccepted}
      onRightsAcceptedChange={setRightsAccepted}
    />
  );
}

function renderUploadPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  return render(<UploadPanelHarness isAuthenticated={isAuthenticated} />);
}

it("requires an explicit rights statement for authenticated uploads", () => {
  renderUploadPanel({ isAuthenticated: true });
  const checkbox = screen.getByRole("checkbox", { name: /我确认拥有或已获得/ });
  expect(checkbox).not.toBeChecked();
  expect(screen.getByLabelText("选择正面图")).toBeDisabled();
  expect(screen.getByRole("link", { name: "服务条款" })).toHaveAttribute(
    "href",
    "/terms",
  );
});

it("keeps guest image selection local without treating it as consent", () => {
  renderUploadPanel({ isAuthenticated: false });
  expect(screen.getByLabelText("选择正面图")).toBeEnabled();
  expect(global.fetch).not.toHaveBeenCalled();
});
```

在上传成功测试中先点击复选框，再断言 Presign 请求体：

```ts
expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string))
  .toMatchObject({
    rightsAttestation: {
      accepted: true,
      version: "image_rights_v1",
    },
  });
```

- [ ] **Step 2: 运行并确认失败**

```powershell
pnpm exec vitest run src/components/workspace/upload-panel.test.tsx
```

Expected: 找不到声明复选框且请求体没有 `rightsAttestation`。

- [ ] **Step 3: 实现由 Workspace 控制的声明 UI 与错误标签**

在 `WorkspaceApp` 新增 `rightsAccepted` state，默认 `false`，并把它作为受控值传给上传面板：

```tsx
<UploadPanel
  {...existingProps}
  rightsAccepted={rightsAccepted}
  onRightsAcceptedChange={setRightsAccepted}
/>
```

`UploadPanelProps` 增加：

```ts
rightsAccepted: boolean;
onRightsAcceptedChange: (accepted: boolean) => void;
```

在图片槽位上方渲染未预选 checkbox 和 `/terms`、`/privacy` 链接；已登录用户的文件 inputs 使用：

```tsx
disabled={uploading || !rightsAccepted}
```

游客保持可选本地文件。Presign body 加入当前声明。错误映射新增：

```ts
case "rights_attestation_required":
  return "请先确认素材与肖像授权声明";
case "rights_attestation_version_mismatch":
  return "授权声明已更新，请重新确认";
```

不要把 checkbox 状态写入 localStorage、游客草稿或服务端 session；组件重新进入时需要主动确认。状态放在 `WorkspaceApp` 是为了 Task 4 的历史资产补签能够复用同一次主动勾选，不允许在 `UploadPanel` 内再维护第二份状态。

- [ ] **Step 4: 验证并提交 UI**

```powershell
pnpm exec vitest run src/components/workspace/upload-panel.test.tsx src/components/workspace/workspace-app.test.tsx
pnpm run typecheck
git add src/components/workspace/upload-panel.tsx src/components/workspace/upload-panel.test.tsx src/components/workspace/workspace-app.tsx src/components/workspace/workspace-app.test.tsx
git commit -m "feat: collect upload rights attestation"
```

### Task 4: 历史资产补签、Preflight 与任务快照

**Files:**
- Create: `src/app/api/assets/attest-rights/route.ts`
- Create: `src/app/api/assets/attest-rights/route.test.ts`
- Modify: `src/server/compliance/rights-attestation.ts`
- Modify: `src/server/compliance/rights-attestation.test.ts`
- Modify: `src/server/jobs/preflight.ts`
- Modify: `src/server/jobs/preflight.test.ts`
- Modify: `src/server/jobs/create-job.ts`
- Modify: `src/server/jobs/create-job.test.ts`
- Modify: `src/app/api/jobs/route.ts`
- Modify: `src/app/api/jobs/route.test.ts`
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/components/workspace/workspace-app.test.tsx`

- [ ] **Step 1: 写历史资产补签失败测试**

```ts
it("attests only assets owned by the signed-in user", async () => {
  const attestAssets = vi.fn().mockRejectedValue(
    new Error("rights_attestation_asset_not_found"),
  );
  const response = await handleAttestAssetRightsRequest(
    new Request("http://localhost/api/assets/attest-rights", {
      method: "POST",
      body: JSON.stringify({
        assetIds: ["asset-other-user"],
        rightsAttestation: { accepted: true, version: "image_rights_v1" },
      }),
    }),
    {
      getSession: async () => ({ user: { id: "user-1" } }),
      attestAssets,
    },
  );
  expect(response.status).toBe(404);
});
```

服务测试覆盖空数组、超过 8 个、重复 ID、已删除、其他用户和幂等重签。

- [ ] **Step 2: 写 Preflight 与任务创建双门禁测试**

```ts
it("blocks assets without rights attestation before job creation", async () => {
  const result = await preflightVideoJob({
    store: createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId: "user-1",
        status: "uploaded",
        detectedRole: "front",
        rightsAttested: false,
      },
    ]),
    userId: "user-1",
    assetIds: ["asset-front"],
    durationSeconds: 8,
    aspectRatio: "9:16",
  });
  expect(result.blockingReasons).toContainEqual({
    code: "rights_attestation_required",
    message: "请先确认所选素材的版权、肖像与商业使用授权。",
  });
  expect(result.missingRightsAttestationAssetIds).toEqual(["asset-front"]);
});
```

`createVideoJobWithAssets` 测试直接绕过 Preflight 仍应抛出 `Rights attestation is required for all assets.`，且 store 没有任务、状态事件或点数流水。成功测试断言：

```ts
const now = new Date("2026-07-11T00:00:00.000Z");

expect(result.job.rightsAttestationSnapshot).toEqual({
  version: "image_rights_v1",
  assetIds: ["asset-front"],
  attestationIds: ["attestation-1"],
  verifiedAt: now.toISOString(),
});
```

- [ ] **Step 3: 运行并确认当前流程没有声明门禁**

```powershell
pnpm exec vitest run src/app/api/assets/attest-rights/route.test.ts src/server/jobs/preflight.test.ts src/server/jobs/create-job.test.ts
```

- [ ] **Step 4: 实现补签 Service 与 API**

在 `RightsAttestationStore` 增加：

```ts
attestExistingAssets(input: {
  userId: string;
  assetIds: string[];
  version: "image_rights_v1";
  statementSnapshot: string;
  locale: string;
  ipHash: string | null;
  userAgentHash: string | null;
  acceptedAt: Date;
}): Promise<{
  attestationId: string;
  assetIds: string[];
}>;
```

Drizzle transaction先用 `userId + inArray(ids) + isNull(deletedAt)` 精确查询；数量不匹配则整体失败，不允许部分补签。随后写 scope=`generation_reconfirmation` 和关联表。

API 状态：未登录 401、输入错误 400、旧版本 409、资产不属于用户 404、服务失败 500。

- [ ] **Step 5: 扩展资产查询与 Preflight**

`JobCreatableAsset` 增加：

```ts
rightsAttested: boolean;
rightsAttestationId: string | null;
```

Drizzle `findOwnedAssets` 使用 `exists` 或按资产聚合的子查询，避免一项资产多次声明造成重复行。Preflight result 增加 `missingRightsAttestationAssetIds: string[]` 并在任何缺失时添加 blocker。

- [ ] **Step 6: 在任务创建中保存声明快照**

在所有资产归属和上传状态检查之后、试用风控之前执行声明检查。使用服务端查询返回的 attestation ID，不信任客户端 ID。`VideoJobCreationStore.createJob` 输入和返回类型加入 `rightsAttestationSnapshot`，并写入 `videoJobs`。

API 将 `Rights attestation is required for all assets.` 映射为：

```json
{ "error": "rights_attestation_required" }
```

HTTP status 为 409。

- [ ] **Step 7: Workspace 自动处理历史资产补签**

当 Preflight 返回缺失资产 ID 且当前 checkbox 已勾选时，调用 `/api/assets/attest-rights`，成功后只重试一次 Preflight；未勾选时显示声明错误并停止。用布尔局部变量防止补签/Preflight 无限循环。

- [ ] **Step 8: 验证并提交完整门禁**

```powershell
pnpm exec vitest run src/server/compliance/rights-attestation.test.ts src/app/api/assets/attest-rights/route.test.ts src/server/jobs/preflight.test.ts src/server/jobs/create-job.test.ts src/app/api/jobs/route.test.ts src/components/workspace/workspace-app.test.tsx
pnpm run typecheck
git add src/server/compliance/rights-attestation.ts src/server/compliance/rights-attestation.test.ts src/app/api/assets/attest-rights src/server/jobs/preflight.ts src/server/jobs/preflight.test.ts src/server/jobs/create-job.ts src/server/jobs/create-job.test.ts src/app/api/jobs/route.ts src/app/api/jobs/route.test.ts src/components/workspace/workspace-app.tsx src/components/workspace/workspace-app.test.tsx
git commit -m "feat: gate generation on rights attestation"
```

### Task 5: 实现侵权案件领域服务与邮件通知

**Files:**
- Create: `src/server/compliance/rights-removal.ts`
- Create: `src/server/compliance/rights-removal.test.ts`
- Create: `src/server/compliance/rights-removal-email.ts`
- Create: `src/server/compliance/rights-removal-email.test.ts`

- [ ] **Step 1: 写输入解析、URL 去敏和限流测试**

```ts
import { describe, expect, it } from "vitest";

import {
  normalizeContentReference,
  parseRightsRemovalInput,
} from "./rights-removal";

describe("rights removal input", () => {
  it("strips signed query and fragment data", () => {
    expect(
      normalizeContentReference(
        "https://app.example/jobs/job-1?token=secret#preview",
      ),
    ).toBe("https://app.example/jobs/job-1");
  });

  it("requires both legal declarations", () => {
    expect(() =>
      parseRightsRemovalInput({
        reporterName: "权利人",
        reporterEmail: "owner@example.com",
        rightsType: "likeness",
        contentReferences: ["job-1"],
        description: "这是超过五十个字符的权利说明，用于证明当前输入不会因为缺少说明长度而失败。",
        goodFaithConfirmed: true,
        accuracyConfirmed: false,
      }),
    ).toThrow("invalid_rights_removal_input");
  });
});
```

Service 测试断言同一 IP 摘要已有 5 条/24h 时抛 `rights_removal_rate_limited`；无 hash secret 的 production 抛配置错误；邮件发送失败仍返回已保存案件。

- [ ] **Step 2: 运行并确认模块缺失**

```powershell
pnpm exec vitest run src/server/compliance/rights-removal.test.ts src/server/compliance/rights-removal-email.test.ts
```

- [ ] **Step 3: 实现规范化类型与 Store**

```ts
export type RightsType =
  | "likeness"
  | "copyright"
  | "trademark"
  | "privacy"
  | "other";

export interface ParsedRightsRemovalInput {
  reporterName: string;
  reporterEmail: string;
  rightsType: RightsType;
  contentReferences: string[];
  description: string;
  goodFaithConfirmed: true;
  accuracyConfirmed: true;
}

export interface RightsRemovalRequestRecord extends ParsedRightsRemovalInput {
  id: string;
  publicReference: string;
  status: "received" | "triaging" | "awaiting_information" |
    "action_required" | "resolved_removed" | "resolved_rejected";
  ipHash: string | null;
  userAgentHash: string | null;
  resolutionSummary: string | null;
  resolvedAt: Date | null;
  redactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeContentReference(value: string) {
  const normalized = value.trim();
  try {
    const url = new URL(normalized);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return normalized.slice(0, 500);
  }
}
```

邮箱使用保守正则并限制 254 字符；姓名 2-100；内容引用 1-5；说明 50-5000；rightsType 必须在枚举内；两项声明必须严格等于 `true`。

`RightsRemovalStore` 定义 `countRecentByIpHash({ ipHash, since })` 和 `createRequest(input)`；提供内存与 Drizzle 实现。

公开编号：

```ts
import { randomBytes } from "node:crypto";

export function createRightsRemovalReference() {
  return `RR-${randomBytes(12).toString("base64url").toUpperCase()}`;
}
```

数据库唯一冲突最多重试 3 次，其他错误直接抛出。

- [ ] **Step 4: 实现案件创建编排**

```ts
export interface SubmitRightsRemovalRequestInput {
  store: RightsRemovalStore;
  input: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  appEnvironment: string;
  hashSecret: string | null | undefined;
  now?: Date;
  notifyLegal: (record: RightsRemovalRequestRecord) => Promise<void>;
  recordNotificationFailure: (input: {
    publicReference: string;
    errorCode: "rights_removal_notification_failed";
    errorMessage: string;
  }) => Promise<void>;
}

export async function submitRightsRemovalRequest({
  store,
  input,
  ipAddress,
  userAgent,
  appEnvironment,
  hashSecret,
  now = new Date(),
  notifyLegal,
  recordNotificationFailure,
}: SubmitRightsRemovalRequestInput) {
  const parsed = parseRightsRemovalInput(input);
  const secret = requireComplianceHashSecret(appEnvironment, hashSecret);
  const ipHash = secret ? hashAbuseSignal(ipAddress, secret) : null;
  const userAgentHash = secret ? hashAbuseSignal(userAgent, secret) : null;
  if (
    ipHash &&
    (await store.countRecentByIpHash({
      ipHash,
      since: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    })) >= 5
  ) {
    throw new Error("rights_removal_rate_limited");
  }
  const record = await createRequestWithUniqueReference({
    store,
    parsed,
    ipHash,
    userAgentHash,
    now,
  });
  try {
    await notifyLegal(record);
  } catch (error) {
    await recordNotificationFailure({
      publicReference: record.publicReference,
      errorCode: "rights_removal_notification_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown email error",
    });
  }
  return { accepted: true as const, reference: record.publicReference };
}
```

- [ ] **Step 5: 实现固定模板 Resend 通知**

复用 `RESEND_API_KEY` 和 `EMAIL_FROM`，新增 `LEGAL_CONTACT_EMAIL`。`getRightsRemovalEmailConfig` 缺少任一值时抛明确配置错误。邮件正文只包含公开编号、权利类型、去敏内容引用和后台链接，不包含 IP 摘要。依赖注入 `sendEmail` 便于测试。`recordNotificationFailure` 的生产实现只记录公开编号、固定错误码和去敏后的 Provider 错误，不记录举报表单正文、邮箱、IP 或 User-Agent。

- [ ] **Step 6: 验证并提交领域服务**

```powershell
pnpm exec vitest run src/server/compliance/rights-removal.test.ts src/server/compliance/rights-removal-email.test.ts
pnpm run typecheck
git add src/server/compliance/rights-removal.ts src/server/compliance/rights-removal.test.ts src/server/compliance/rights-removal-email.ts src/server/compliance/rights-removal-email.test.ts
git commit -m "feat: accept auditable rights removal cases"
```

### Task 6: 建立公开投诉 API、页面和法律入口

**Files:**
- Create: `src/app/api/compliance/rights-removal/route.ts`
- Create: `src/app/api/compliance/rights-removal/route.test.ts`
- Create: `src/app/takedown/page.tsx`
- Create: `src/components/public/takedown-form.tsx`
- Create: `src/components/public/takedown-form.test.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/faq/page.tsx`
- Modify: `src/components/layout/site-footer-content.tsx`
- Modify: `src/components/layout/site-footer-content.test.tsx`
- Modify: `src/components/public/public-pages.test.tsx`

- [ ] **Step 1: 写 API 状态映射测试**

```ts
const validRightsRemovalBody = {
  reporterName: "权利人",
  reporterEmail: "owner@example.com",
  rightsType: "likeness",
  contentReferences: ["https://app.example/jobs/job-1?token=secret"],
  description:
    "我是相关人物的合法权利人，该内容未经授权使用了人物肖像，请核验并处理对应内容。此说明仅用于自动化测试。",
  goodFaithConfirmed: true,
  accuracyConfirmed: true,
  companyWebsite: "",
};

it("returns a public reference after the case is persisted", async () => {
  const response = await handleRightsRemovalRequest(
    new Request("http://localhost/api/compliance/rights-removal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validRightsRemovalBody),
    }),
    {
      submitRequest: async () => ({ accepted: true, reference: "RR-TEST123" }),
    },
  );
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({
    accepted: true,
    reference: "RR-TEST123",
  });
});
```

添加：body > 16KB -> 413，蜜罐非空 -> 通用 202，输入错误 -> 400，限流 -> 429，hash 配置缺失/数据库失败 -> 503。蜜罐响应不得调用 store。

- [ ] **Step 2: 写公开页面交互测试**

```tsx
function fillValidRightsRemovalForm() {
  fireEvent.change(screen.getByLabelText("举报人姓名"), {
    target: { value: "权利人" },
  });
  fireEvent.change(screen.getByLabelText("联系邮箱"), {
    target: { value: "owner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("权利类型"), {
    target: { value: "likeness" },
  });
  fireEvent.change(screen.getByLabelText("涉及内容"), {
    target: { value: "https://app.example/jobs/job-1" },
  });
  fireEvent.change(screen.getByLabelText("权利说明"), {
    target: {
      value:
        "我是相关人物的合法权利人，该内容未经授权使用了人物肖像，请核验并处理对应内容。此说明仅用于自动化测试。",
    },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /诚信声明/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /准确性声明/ }));
}

it("submits a rights notice and shows only its public reference", async () => {
  render(<TakedownForm legalContactEmail="legal@example.com" />);
  fillValidRightsRemovalForm();
  fireEvent.click(screen.getByRole("button", { name: "提交权利通知" }));
  expect(await screen.findByText(/RR-TEST123/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "legal@example.com" })).toHaveAttribute(
    "href",
    "mailto:legal@example.com",
  );
});
```

断言两个 checkbox 未预选、没有附件 input、错误文本不暴露案件/用户存在性。

- [ ] **Step 3: 运行并确认页面与 API 缺失**

```powershell
pnpm exec vitest run src/app/api/compliance/rights-removal/route.test.ts src/components/public/takedown-form.test.tsx src/components/public/public-pages.test.tsx src/components/layout/site-footer-content.test.tsx
```

- [ ] **Step 4: 实现公开 API**

先检查 `content-length`，再读取 `request.text()`；使用 `new TextEncoder().encode(rawBody).byteLength` 复核实际 UTF-8 body，即使客户端没有发送长度头，超过 16KB 也返回 413。随后用 `JSON.parse` 解析。读取 `x-forwarded-for` 第一项、`x-real-ip` 和 User-Agent。蜜罐字段名为 `companyWebsite`；非空时返回固定 202 `{ accepted: true, reference: "RR-RECEIVED" }`，但不落库也不发信。其他错误按 Step 1 映射，未知错误只记录服务端日志并返回 `rights_removal_unavailable`。

- [ ] **Step 5: 实现无附件公开表单**

`/takedown` 是公开 server page，读取 `process.env.LEGAL_CONTACT_EMAIL` 并传给 client form。表单采用原生 label/input/textarea/select，固定字段长度与 required 属性；提交期间禁用按钮，成功后只显示公开编号和保存提示。不要渲染用户输入为 HTML。

- [ ] **Step 6: 更新条款、隐私、FAQ 和页脚**

使用规格中已确认的声明文字和保留周期。Terms 加“肖像与未成年人授权”“禁止用途”“权利通知”；Privacy 加“声明记录”“投诉数据”“三年保留”；FAQ 加真人/儿童授权与投诉问题；页脚新增：

```tsx
<Link href="/takedown">侵权删除</Link>
```

- [ ] **Step 7: 验证并提交公开入口**

```powershell
pnpm exec vitest run src/app/api/compliance/rights-removal/route.test.ts src/components/public/takedown-form.test.tsx src/components/public/public-pages.test.tsx src/components/layout/site-footer-content.test.tsx
pnpm run typecheck
git add src/app/api/compliance src/app/takedown src/components/public/takedown-form.tsx src/components/public/takedown-form.test.tsx src/app/terms/page.tsx src/app/privacy/page.tsx src/app/faq/page.tsx src/components/layout/site-footer-content.tsx src/components/layout/site-footer-content.test.tsx src/components/public/public-pages.test.tsx
git commit -m "feat: add public rights removal intake"
```

### Task 7: 实现后台案件查询、权限和状态审计

**Files:**
- Create: `src/server/admin/rights-removal.ts`
- Create: `src/server/admin/rights-removal.test.ts`
- Create: `src/app/api/admin/rights-removal/route.ts`
- Create: `src/app/api/admin/rights-removal/route.test.ts`
- Create: `src/app/api/admin/rights-removal/[id]/status/route.ts`
- Create: `src/app/api/admin/rights-removal/[id]/status/route.test.ts`
- Modify: `src/server/auth/admin-access.ts`
- Modify: `src/server/auth/admin-access.test.ts`

- [ ] **Step 1: 写角色权限与状态迁移测试**

```ts
it("lets operators triage but only admins resolve a case", async () => {
  const store = createInMemoryAdminRightsRemovalStore([
    {
      id: "request-1",
      publicReference: "RR-TEST123",
      status: "received",
      resolutionSummary: null,
      resolvedAt: null,
    },
  ]);
  const auditStore = createInMemoryAdminAuditStore();

  await expect(
    updateRightsRemovalStatus({
      store,
      auditStore,
      actor: { userId: "operator-1", email: "ops@example.com", role: "operator" },
      requestId: "request-1",
      status: "triaging",
      reason: "开始核验权利通知",
    }),
  ).resolves.toMatchObject({ status: "triaging" });

  await expect(
    updateRightsRemovalStatus({
      store,
      auditStore,
      actor: { userId: "operator-1", email: "ops@example.com", role: "operator" },
      requestId: "request-1",
      status: "resolved_removed",
      reason: "确认并完成删除处理",
      resolutionSummary: "已核验并由运维删除目标资源",
    }),
  ).rejects.toThrow("Actor cannot resolve rights removal requests.");
});
```

测试非法跳转、原因少于 6 字符、最终状态缺少 summary、找不到案件和 audit target。

- [ ] **Step 2: 运行并确认服务缺失**

```powershell
pnpm exec vitest run src/server/admin/rights-removal.test.ts src/server/auth/admin-access.test.ts
```

- [ ] **Step 3: 扩展管理员权限**

`AdminAction` 增加：

```ts
| "rights_removal:triage"
| "rights_removal:resolve"
```

operator allowlist 只加入 `rights_removal:triage`；admin 仍可执行全部。

- [ ] **Step 4: 实现后台 Store 与状态机**

状态更新使用最小记录，列表查询返回完整 `RightsRemovalRequestRecord`：

```ts
export interface RightsRemovalStatusRecord {
  id: string;
  publicReference: string;
  status: RightsRemovalRequestRecord["status"];
  resolutionSummary: string | null;
  resolvedAt: Date | null;
}
```

允许迁移：

```ts
const allowedRightsRemovalTransitions = {
  received: ["triaging"],
  triaging: ["awaiting_information", "action_required", "resolved_rejected"],
  awaiting_information: ["triaging", "action_required", "resolved_rejected"],
  action_required: ["triaging", "resolved_removed", "resolved_rejected"],
  resolved_removed: [],
  resolved_rejected: [],
} as const;
```

`listRightsRemovalRequests` 支持 status、rightsType 和 limit，按 createdAt 倒序。`updateRightsRemovalStatus` 校验权限与迁移；最终状态写 `resolvedAt` 和 summary；审计 action 使用实际权限名，targetType=`rights_removal_request`，before/after snapshot 经过现有 redaction。

- [ ] **Step 5: 实现后台 API**

GET 需要 admin session，operator/admin 均可查询。POST status route 从 URL 获取 id，body 只接受 status、reason、resolutionSummary；权限错误 403，输入/迁移错误 400，not found 404，未知失败 500。

- [ ] **Step 6: 验证并提交后台服务**

```powershell
pnpm exec vitest run src/server/admin/rights-removal.test.ts src/server/auth/admin-access.test.ts src/app/api/admin/rights-removal/route.test.ts 'src/app/api/admin/rights-removal/[id]/status/route.test.ts'
pnpm run typecheck
git add src/server/admin/rights-removal.ts src/server/admin/rights-removal.test.ts src/server/auth/admin-access.ts src/server/auth/admin-access.test.ts src/app/api/admin/rights-removal
git commit -m "feat: manage rights removal cases"
```

### Task 8: 建立后台案件工作台

**Files:**
- Create: `src/app/admin/rights-removal/page.tsx`
- Create: `src/app/admin/rights-removal/page.test.tsx`
- Create: `src/components/admin/rights-removal-table.tsx`
- Create: `src/components/admin/rights-removal-table.test.tsx`
- Modify: `src/app/app-shell.ts`
- Modify: `src/app/app-shell.test.ts`

- [ ] **Step 1: 写导航、列表和操作测试**

```tsx
const requestFixture: RightsRemovalRequestRecord = {
  id: "request-1",
  publicReference: "RR-TEST123",
  status: "received",
  reporterName: "权利人",
  reporterEmail: "owner@example.com",
  rightsType: "likeness",
  contentReferences: ["https://app.example/jobs/job-1"],
  description:
    "我是相关人物的合法权利人，该内容未经授权使用了人物肖像，请核验并处理对应内容。此说明仅用于自动化测试。",
  goodFaithConfirmed: true,
  accuracyConfirmed: true,
  ipHash: "ip-hash",
  userAgentHash: "ua-hash",
  resolutionSummary: null,
  resolvedAt: null,
  redactedAt: null,
  createdAt: new Date("2026-07-11T00:00:00.000Z"),
  updatedAt: new Date("2026-07-11T00:00:00.000Z"),
};

it("adds the rights removal queue to admin navigation", () => {
  expect(buildAdminNav("/admin/rights-removal")).toContainEqual(
    expect.objectContaining({
      href: "/admin/rights-removal",
      label: "侵权处理",
      active: true,
    }),
  );
});

it("shows case identity and requires a reason for status changes", () => {
  render(<RightsRemovalTable requests={[requestFixture]} actorRole="operator" />);
  expect(screen.getByText("RR-TEST123")).toBeInTheDocument();
  expect(screen.getByText("likeness")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "更新状态" })).toBeDisabled();
  expect(screen.queryByRole("option", { name: "已删除" })).not.toBeInTheDocument();
});
```

admin 页面测试断言未授权 redirect，合法 operator 能看到案件；表格不显示 IP 摘要。

- [ ] **Step 2: 运行并确认组件与导航缺失**

```powershell
pnpm exec vitest run src/app/app-shell.test.ts src/components/admin/rights-removal-table.test.tsx src/app/admin/rights-removal/page.test.tsx
```

- [ ] **Step 3: 实现工作台**

复用 `AdminShell` 和 `buildAdminNav`。列表是扫描型工作表，不做营销卡片；列包含编号、状态、权利类型、举报人邮箱、内容引用、创建时间和操作。内容引用用纯文本或安全 `<a rel="noreferrer">`，禁止 `dangerouslySetInnerHTML`。

operator 下拉只提供 triage 状态；admin 额外提供两个最终状态。最终状态显示并要求 resolution summary。提交到 status API，成功后 `router.refresh()`，失败显示通用错误。

- [ ] **Step 4: 验证并提交后台 UI**

```powershell
pnpm exec vitest run src/app/app-shell.test.ts src/components/admin/rights-removal-table.test.tsx src/app/admin/rights-removal/page.test.tsx
pnpm run typecheck
git add src/app/app-shell.ts src/app/app-shell.test.ts src/app/admin/rights-removal src/components/admin/rights-removal-table.tsx src/components/admin/rights-removal-table.test.tsx
git commit -m "feat: add rights removal admin queue"
```

### Task 9: 实施三年保留期去标识化

**Files:**
- Create: `src/server/compliance/retention.ts`
- Create: `src/server/compliance/retention.test.ts`
- Create: `src/app/api/internal/compliance/retention/route.ts`
- Create: `src/app/api/internal/compliance/retention/route.test.ts`

- [ ] **Step 1: 写到期与未到期记录测试**

```ts
function rightsRemovalRequest(
  overrides: Partial<RightsRemovalRequestRecord> = {},
): RightsRemovalRequestRecord {
  const createdAt = new Date("2027-01-01T00:00:00.000Z");
  return {
    id: "request-default",
    publicReference: "RR-DEFAULT",
    status: "received",
    reporterName: "举报人",
    reporterEmail: "reporter@example.com",
    rightsType: "likeness",
    contentReferences: ["https://app.example/jobs/job-1"],
    description: "用于保留期测试的有效权利说明内容，长度超过五十个字符并且不包含任何真实敏感信息。",
    goodFaithConfirmed: true,
    accuracyConfirmed: true,
    ipHash: "ip-hash",
    userAgentHash: "ua-hash",
    resolutionSummary: null,
    resolvedAt: null,
    redactedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

it("redacts resolved cases older than three years", async () => {
  const now = new Date("2030-07-11T00:00:00.000Z");
  const store = createInMemoryComplianceRetentionStore({
    removalRequests: [
      rightsRemovalRequest({
        id: "request-old",
        status: "resolved_removed",
        resolvedAt: new Date("2027-07-10T00:00:00.000Z"),
        reporterName: "权利人",
        reporterEmail: "owner@example.com",
      }),
      rightsRemovalRequest({
        id: "request-recent",
        status: "resolved_rejected",
        resolvedAt: new Date("2029-07-10T00:00:00.000Z"),
      }),
    ],
  });

  const result = await redactExpiredComplianceData({ store, now, limit: 100 });

  expect(result.removalRequestCount).toBe(1);
  expect(store.listRemovalRequests()[0]).toMatchObject({
    reporterName: "[REDACTED]",
    reporterEmail: "[REDACTED]",
    contentReferences: [],
    description: "[REDACTED]",
    ipHash: null,
    userAgentHash: null,
    redactedAt: now,
  });
  expect(store.listRemovalRequests()[1]?.redactedAt).toBeNull();
});
```

另一个测试创建 acceptedAt 超过三年、所有关联资产均已软删除的声明，断言 `userId` 变为 `[REDACTED]`、IP/User-Agent 摘要清空；仍有关联未删除资产时不得去标识化。重复执行不重复处理 `redactedAt` 非空记录。

- [ ] **Step 2: 运行并确认服务缺失**

```powershell
pnpm exec vitest run src/server/compliance/retention.test.ts
```

- [ ] **Step 3: 实现保留期 Store 和服务**

```ts
export const COMPLIANCE_RETENTION_YEARS = 3;

export interface ComplianceRetentionStore {
  redactExpiredRemovalRequests(input: {
    cutoff: Date;
    redactedAt: Date;
    limit: number;
  }): Promise<number>;
  redactExpiredAttestations(input: {
    cutoff: Date;
    redactedAt: Date;
    limit: number;
  }): Promise<number>;
}

export async function redactExpiredComplianceData({
  store,
  now = new Date(),
  limit = 100,
}: {
  store: ComplianceRetentionStore;
  now?: Date;
  limit?: number;
}) {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - COMPLIANCE_RETENTION_YEARS);
  const removalRequestCount = await store.redactExpiredRemovalRequests({
    cutoff,
    redactedAt: now,
    limit: normalizedLimit,
  });
  const attestationCount = await store.redactExpiredAttestations({
    cutoff,
    redactedAt: now,
    limit: normalizedLimit,
  });
  return { removalRequestCount, attestationCount };
}
```

Drizzle 查询只选择 `redactedAt IS NULL`。投诉必须为最终状态且 `resolvedAt < cutoff`。声明必须 `acceptedAt < cutoff`，且不存在通过 `asset_rights_attestations` 关联的 `deletedAt IS NULL` 资产。更新只做去标识化，不删除公开编号、状态、声明版本、声明文本或审计关系。

- [ ] **Step 4: 写受保护内部路由测试**

```ts
it("requires the cron secret and returns redaction counts", async () => {
  const unauthorized = await handleComplianceRetentionRequest(
    new Request("http://localhost/api/internal/compliance/retention", {
      method: "POST",
    }),
    { cronSecret: "expected", runRetention: vi.fn() },
  );
  expect(unauthorized.status).toBe(401);

  const authorized = await handleComplianceRetentionRequest(
    new Request("http://localhost/api/internal/compliance/retention", {
      method: "POST",
      headers: { authorization: "Bearer expected" },
    }),
    {
      cronSecret: "expected",
      runRetention: async () => ({ removalRequestCount: 2, attestationCount: 3 }),
    },
  );
  expect(await authorized.json()).toEqual({
    ok: true,
    removalRequestCount: 2,
    attestationCount: 3,
  });
});
```

缺少生产 `CRON_JOB_SECRET` 返回 503，不允许空 secret 等价通过。服务异常返回 500 和通用错误。

- [ ] **Step 5: 实现内部路由并提交**

```powershell
pnpm exec vitest run src/server/compliance/retention.test.ts src/app/api/internal/compliance/retention/route.test.ts
pnpm run typecheck
git add src/server/compliance/retention.ts src/server/compliance/retention.test.ts src/app/api/internal/compliance/retention
git commit -m "feat: redact expired compliance data"
```

### Task 10: 补齐环境健康、README 与核心文档

**Files:**
- Modify: `.env.example`
- Modify: `src/server/ops/health.ts`
- Modify: `src/server/ops/health.test.ts`
- Modify: `src/app/api/health/route.test.ts`
- Modify: `README.md`
- Modify: `docs/PRD.md`
- Modify: `docs/TECHNICAL_ARCHITECTURE.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `docs/DEVELOPMENT_SPEC.md`

- [ ] **Step 1: 写法律合规健康检查失败测试**

```ts
it("reports production legal compliance configuration", () => {
  const report = getRuntimeHealth({
    APP_ENV: "production",
    LEGAL_CONTACT_EMAIL: "",
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    ABUSE_HASH_SECRET: "",
  });
  expect(report.checks.legalCompliance.missing).toEqual([
    "LEGAL_CONTACT_EMAIL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "ABUSE_HASH_SECRET",
  ]);
});
```

- [ ] **Step 2: 运行并确认缺少 health section**

```powershell
pnpm exec vitest run src/server/ops/health.test.ts src/app/api/health/route.test.ts
```

- [ ] **Step 3: 增加配置和环境说明**

`.env.example` 在 Resend/合规段增加：

```dotenv
# Inbox for likeness, copyright, trademark, privacy, and takedown notices.
LEGAL_CONTACT_EMAIL=
```

`RuntimeHealthReport.checks` 加 `legalCompliance`。production/staging 使用四个必需变量；development/test 返回 pending 而不是让整站 ready=false。复用 README 计划已经增加的 `APP_ENV` 和 `ABUSE_HASH_SECRET`，不要重复变量。

- [ ] **Step 4: 同步 README 与核心产品文档**

明确记录：

```text
所有服务端上传必须保存 image_rights_v1 声明。
真人与儿童模特分别需要肖像/商业授权和监护人授权。
投诉入口为 /takedown，数据库受理成功后才返回案件编号。
投诉不会自动删除内容，最终处理需要管理员核验和审计。
真人模特付费 Beta 的上线 blocker 包含真实投诉演练。
合规保留期清理由 POST /api/internal/compliance/retention 执行，使用 CRON_JOB_SECRET 鉴权。
```

PRD/架构/SPEC 中把声明放在素材上传与任务创建前置门禁，把投诉队列放在后台运营能力，不要混入视频生成状态机。README 记录由 cron-job.org 每日调用一次保留期端点，并使用 `Authorization: Bearer $CRON_JOB_SECRET`。

- [ ] **Step 5: 验证文档和配置并提交**

```powershell
pnpm exec vitest run src/server/ops/health.test.ts src/app/api/health/route.test.ts
rg -n 'image_rights_v1|/takedown|LEGAL_CONTACT_EMAIL|监护人授权' README.md docs/PRD.md docs/TECHNICAL_ARCHITECTURE.md docs/IMPLEMENTATION_PLAN.md docs/DEVELOPMENT_SPEC.md .env.example
git diff --check
git add .env.example src/server/ops/health.ts src/server/ops/health.test.ts src/app/api/health/route.test.ts README.md docs/PRD.md docs/TECHNICAL_ARCHITECTURE.md docs/IMPLEMENTATION_PLAN.md docs/DEVELOPMENT_SPEC.md
git commit -m "docs: define rights compliance operations"
```

### Task 11: 完整回归与发布前演练

**Files:**
- Verify only.

- [ ] **Step 1: 运行合规聚焦测试**

```powershell
pnpm exec vitest run src/lib/db/schema/index.test.ts src/server/compliance/rights-attestation.test.ts src/app/api/uploads/presign/route.test.ts src/app/api/uploads/complete/route.test.ts src/app/api/assets/attest-rights/route.test.ts src/server/jobs/preflight.test.ts src/server/jobs/create-job.test.ts src/app/api/jobs/route.test.ts src/components/workspace/upload-panel.test.tsx src/components/workspace/workspace-app.test.tsx src/server/compliance/rights-removal.test.ts src/server/compliance/rights-removal-email.test.ts src/app/api/compliance/rights-removal/route.test.ts src/components/public/takedown-form.test.tsx src/server/admin/rights-removal.test.ts src/app/api/admin/rights-removal/route.test.ts 'src/app/api/admin/rights-removal/[id]/status/route.test.ts' src/components/admin/rights-removal-table.test.tsx src/app/admin/rights-removal/page.test.tsx src/server/compliance/retention.test.ts src/app/api/internal/compliance/retention/route.test.ts src/components/public/public-pages.test.tsx src/components/layout/site-footer-content.test.tsx src/server/ops/health.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行工程全量检查**

```powershell
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: 全部退出码 0。若失败来自执行前已有用户改动，记录具体文件与错误，不得覆盖或回滚用户改动。

- [ ] **Step 3: 进行真实本地上传门禁验收**

启动应用，验证游客本地选图、登录后未勾选不可上传、勾选后 Presign/PUT/Complete 成功、数据库存在声明与资产关联、任务快照包含同一版本。直接调用缺少声明的 API 必须失败。

- [ ] **Step 4: 进行投诉链路演练**

在配置真实测试邮箱后提交一条 `likeness` 通知，确认：

```text
公开页面显示 RR- 编号
数据库案件状态为 received
邮件到达 LEGAL_CONTACT_EMAIL
operator 可以 triage 但不能最终关闭
admin 可以在填写 summary 后 resolved_rejected/removed
admin_audit_logs 存在 before/after
数据库、邮件和日志中没有 signed URL query、原始 IP 或原始 User-Agent
```

- [ ] **Step 5: 演练邮件失败与数据库失败**

使用注入依赖让 Resend 抛错，确认 API 仍返回已持久化案件编号。让 store 抛错，确认 API 返回 503 且不返回 `RR-` 编号。

- [ ] **Step 6: 检查迁移、差异和工作区边界**

```powershell
pnpm db:migrate
git diff --check
git status --short
```

Expected: 迁移成功，无空白错误；执行前存在的用户改动没有被清理或静默覆盖。
