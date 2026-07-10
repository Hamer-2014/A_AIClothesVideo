# README and Development Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a reliable root README and a reproducible local startup path for both the main repository and shared-dependency worktrees.

**Architecture:** Keep the root Next.js application on pnpm, keep the Cloud Run worker as an independent npm build context, and expose configuration readiness through the existing health report. Extract Turbopack root resolution into a small pure helper so main-repository and `.worktree/*` layouts are both testable.

**Tech Stack:** Next.js 16, TypeScript, pnpm 9.15.4, Vitest, Neon Postgres, better-auth, Cloudflare R2, Cloud Run.

---

## Execution Preconditions

- The current working tree contains user changes in files unrelated to most tasks in this plan. Do not reset, clean, stash, or overwrite them.
- If execution moves to a dedicated worktree, first ensure the user's uncommitted changes are either intentionally excluded or committed by the user. Do not silently build from a clean branch and later overwrite the dirty main worktree.
- Reference design: `docs/superpowers/specs/2026-07-10-readme-40s-rotation-templates-design.md`.

## File Map

- Create `src/lib/workspace/turbopack-root.ts`: pure repository-root resolver.
- Create `src/lib/workspace/turbopack-root.test.ts`: main-repository and worktree path tests.
- Modify `next.config.ts`: consume the tested resolver.
- Modify `src/server/ops/health.ts`: report `APP_ENV` and require the abuse hash secret for full readiness.
- Modify `src/server/ops/health.test.ts`: cover the new health behavior.
- Modify `.env.example`: add missing environment and Beta keys with safe comments.
- Modify `package.json`: declare the supported Node.js range.
- Delete root `package-lock.json`: remove the conflicting root npm lockfile.
- Create `README.md`: canonical development and deployment entry point.

### Task 1: Make Turbopack Root Resolution Location-Aware

**Files:**
- Create: `src/lib/workspace/turbopack-root.ts`
- Create: `src/lib/workspace/turbopack-root.test.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveTurbopackRoot } from "./turbopack-root";

describe("resolveTurbopackRoot", () => {
  it("keeps the repository directory when Next runs from the main checkout", () => {
    const repository = path.resolve("tmp", "a_runwaytools");
    expect(resolveTurbopackRoot(repository)).toBe(repository);
  });

  it("returns the shared repository when Next runs from a named worktree", () => {
    const repository = path.resolve("tmp", "a_runwaytools");
    const worktree = path.join(repository, ".worktree", "feature-name");
    expect(resolveTurbopackRoot(worktree)).toBe(repository);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run:

```powershell
pnpm exec vitest run src/lib/workspace/turbopack-root.test.ts
```

Expected: FAIL because `./turbopack-root` does not exist.

- [ ] **Step 3: Add the minimal pure resolver**

```ts
import path from "node:path";

export function resolveTurbopackRoot(configDirectory: string) {
  const parent = path.dirname(configDirectory);

  return path.basename(parent) === ".worktree"
    ? path.dirname(parent)
    : configDirectory;
}
```

- [ ] **Step 4: Update `next.config.ts` to use the helper**

```ts
import type { NextConfig } from "next";

import { resolveTurbopackRoot } from "./src/lib/workspace/turbopack-root";

const nextConfig: NextConfig = {
  turbopack: {
    root: resolveTurbopackRoot(__dirname),
  },
};

export default nextConfig;
```

- [ ] **Step 5: Run the focused test and typecheck**

Run:

```powershell
pnpm exec vitest run src/lib/workspace/turbopack-root.test.ts
pnpm run typecheck
```

Expected: both commands PASS.

- [ ] **Step 6: Commit the resolver change**

```powershell
git add next.config.ts src/lib/workspace/turbopack-root.ts src/lib/workspace/turbopack-root.test.ts
git commit -m "fix: resolve turbopack root across checkouts"
```

### Task 2: Align Environment Readiness With Runtime Requirements

**Files:**
- Modify: `.env.example`
- Modify: `src/server/ops/health.ts`
- Modify: `src/server/ops/health.test.ts`

- [ ] **Step 1: Add failing health-report tests**

Append these exact cases to the existing `describe("runtime health", ...)` block:

```ts
it("uses APP_ENV as the business environment", () => {
  const report = getRuntimeHealth({
    APP_ENV: "staging",
    NODE_ENV: "production",
  });

  expect(report.environment).toBe("staging");
});

it("reports a missing abuse hash secret in internal security readiness", () => {
  const report = getRuntimeHealth({
    INTERNAL_WORKER_SECRET: "worker-secret",
    CRON_JOB_SECRET: "cron-secret",
  });

  expect(report.checks.internalSecurity.missing).toContain(
    "ABUSE_HASH_SECRET",
  );
});
```

- [ ] **Step 2: Run the health test and confirm both new assertions fail**

```powershell
pnpm exec vitest run src/server/ops/health.test.ts
```

Expected: FAIL because environment uses `NODE_ENV` and internal security does not check `ABUSE_HASH_SECRET`.

- [ ] **Step 3: Implement the health changes**

Change the internal security check and environment selection to:

```ts
internalSecurity: buildCheck(env, [
  "INTERNAL_WORKER_SECRET",
  "CRON_JOB_SECRET",
  "ABUSE_HASH_SECRET",
]),
```

```ts
environment:
  trimEnv(env, "APP_ENV") || trimEnv(env, "NODE_ENV") || "development",
```

- [ ] **Step 4: Add the missing `.env.example` entries**

Place `APP_ENV` next to `NODE_ENV`, `ABUSE_HASH_SECRET` in the internal-security section, and the 40-second switch in the video-generation section:

```dotenv
APP_ENV=development
```

```dotenv
# HMAC secret for hashing trial-abuse signals. Required outside local development.
ABUSE_HASH_SECRET=
```

```dotenv
# Enables creation of new 40-second paid Beta jobs.
# Existing jobs continue even if this is later disabled.
VIDEO_DURATION_40_ENABLED=false
```

- [ ] **Step 5: Run health tests and typecheck**

```powershell
pnpm exec vitest run src/server/ops/health.test.ts src/app/api/health/route.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the environment-readiness change**

```powershell
git add .env.example src/server/ops/health.ts src/server/ops/health.test.ts
git commit -m "docs: align local environment readiness"
```

### Task 3: Standardize Root Tooling on pnpm

**Files:**
- Modify: `package.json`
- Delete: `package-lock.json`
- Preserve: `pnpm-lock.yaml`
- Preserve: `workers/stitch-worker/package-lock.json`

- [ ] **Step 1: Declare the Node.js runtime requirement**

Add next to `packageManager`:

```json
"engines": {
  "node": ">=20.9.0"
}
```

- [ ] **Step 2: Delete only the root npm lockfile**

Use `apply_patch` to delete `package-lock.json`. Do not delete `workers/stitch-worker/package-lock.json`.

- [ ] **Step 3: Verify the pnpm lockfile is reproducible**

```powershell
pnpm install --frozen-lockfile
```

Expected: exit code 0 without modifying `pnpm-lock.yaml`.

- [ ] **Step 4: Verify lockfile ownership**

```powershell
git status --short package.json package-lock.json pnpm-lock.yaml workers/stitch-worker/package-lock.json
```

Expected: `package.json` modified, root `package-lock.json` deleted, and neither retained lockfile modified.

- [ ] **Step 5: Commit the tooling cleanup**

```powershell
git add package.json package-lock.json
git commit -m "build: standardize root installs on pnpm"
```

### Task 4: Create the Root README

**Files:**
- Create: `README.md`
- Reference: `.env.example`
- Reference: `docs/deployment/cloud-run-stitch.md`

- [ ] **Step 1: Create `README.md` with the agreed section structure**

The document must contain these exact top-level sections:

```markdown
# A RunwayTools

面向跨境与独立站中小服装卖家的商品短视频生成工具。主应用使用 Next.js，长时间视频拼接由独立 Cloud Run stitch-worker 执行。

## 系统边界

- `src/`：Next.js/Vercel 主应用。
- `workers/stitch-worker/`：Cloud Run + ffmpeg 拼接与抽帧服务。
- Neon Postgres：任务状态机、点数、审计和业务数据。
- Cloudflare R2：用户图片、片段、最终视频和 QA 帧。

## 前置要求

- Node.js 20.9+，推荐 Node.js 22 LTS。
- pnpm 9.15.4。
- Neon/Postgres 数据库。
- 仅在本地运行 stitch-worker 时需要 ffmpeg。

## 5 分钟启动主应用

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

编辑 `.env.local`，至少配置 `APP_URL`、`APP_ENV`、`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`，然后运行：

```powershell
pnpm db:migrate
pnpm dev
```

访问 `http://localhost:3000` 和 `http://localhost:3000/api/health`。`ready=false` 表示仍有外部模块未配置，不代表 Next.js 没有启动。

## 环境变量

以 `.env.example` 为唯一变量清单。变量按基础认证、Resend、Creem、R2、内部任务、AI Provider 和视频生成分组。未配置真实 Key 时，对应能力必须不可用，不能返回假成功。

`PROMPT_MODERATION_MODE=dev_bypass` 只允许个人本地开发；共享环境、staging 和 production 必须使用 Creem Moderation 并 fail closed。

## 完整生成链路

完整链路需要依次配置 Neon、Google OAuth、Resend、R2、Creem、DeepSeek、视觉模型、APIMart、Cloud Run 和 cron-job.org。先用 `/api/health` 检查配置，再创建真实测试任务。

## 常用命令

```powershell
pnpm dev
pnpm db:migrate
pnpm db:studio
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
$env:JOB_ID = Read-Host 'Enter an existing video job id'
pnpm run smoke:backend -- --job-id $env:JOB_ID
pnpm run verify:blockers -- --json
```

## Stitch Worker

```powershell
Set-Location workers/stitch-worker
npm ci
npm run build
npm start
```

worker 默认监听 `http://localhost:8080`，本地还需要 ffmpeg 和 worker/R2 环境变量。正式部署与验收见 `docs/deployment/cloud-run-stitch.md`。

## 常见问题

- `DATABASE_URL is required`：检查 `.env.local`，并确认命令从仓库根目录执行。
- 认证变量缺失：Google 登录需要 better-auth secret、Google client id 和 client secret。
- `/api/health` 为 `ready=false`：读取 `summary.missing`，按模块补齐变量。
- R2 上传失败：检查 account id、bucket、access key 权限和 bucket 是否保持私有。
- worktree 依赖异常：默认复用主仓库依赖，不要在 worktree 临时安装另一套版本。

## 核心文档

- `docs/PRD.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_SPEC.md`
- `docs/STYLE_PRESET_DESIGN.md`
- `docs/deployment/cloud-run-stitch.md`
```

Do not add any secret values or local `.env.local` contents.

- [ ] **Step 2: Validate every referenced local path**

```powershell
$paths = @(
  'docs/PRD.md',
  'docs/TECHNICAL_ARCHITECTURE.md',
  'docs/IMPLEMENTATION_PLAN.md',
  'docs/DEVELOPMENT_SPEC.md',
  'docs/STYLE_PRESET_DESIGN.md',
  'docs/deployment/cloud-run-stitch.md',
  'workers/stitch-worker/package.json'
)
$paths | ForEach-Object { if (-not (Test-Path $_)) { throw "Missing README path: $_" } }
```

Expected: no output and exit code 0.

- [ ] **Step 3: Verify the README contains no secret values**

```powershell
rg -n 'sk-[A-Za-z0-9]|postgres://[^A-Z\s]|BEGIN (RSA|PRIVATE)' README.md
```

Expected: no matches.

- [ ] **Step 4: Commit the README**

```powershell
git add README.md
git commit -m "docs: add local setup guide"
```

### Task 5: Verify the Development Entry Point

**Files:**
- Verify only; do not add unrelated formatting changes.

- [ ] **Step 1: Run focused tests**

```powershell
pnpm exec vitest run src/lib/workspace/turbopack-root.test.ts src/server/ops/health.test.ts src/app/api/health/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the engineering checks**

```powershell
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: all commands PASS. If an existing user change fails a check, report the exact failing file and preserve the change.

- [ ] **Step 3: Start the local server and inspect health**

```powershell
pnpm dev
```

In another terminal:

```powershell
Invoke-RestMethod http://localhost:3000/api/health | ConvertTo-Json -Depth 6
```

Expected: HTTP 200, `service = "a-runwaytools"`, and either `ready=true` or an explicit `summary.missing` list.

- [ ] **Step 4: Review the final diff**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing user changes remain untouched.
