# A RunwayTools

面向跨境与独立站中小服装卖家的商品短视频生成工具。主应用使用 Next.js，长时间视频拼接由独立 Cloud Run `stitch-worker` 执行。

## 系统边界

- `src/`：Next.js/Vercel 主应用。
- `workers/stitch-worker/`：Cloud Run + ffmpeg 拼接与抽帧服务。
- Neon Postgres：任务状态机、点数、审计和业务数据。
- Cloudflare R2：用户图片、片段、最终视频和 QA 帧。

## 前置要求

- Node.js 20.9+，推荐 Node.js 22 LTS。
- pnpm 9.15.4。
- Neon/Postgres 数据库。
- 仅在本地运行 `stitch-worker` 时需要 ffmpeg。

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
