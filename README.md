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

staging/production 还必须配置 `LEGAL_CONTACT_EMAIL`、`RESEND_API_KEY`、`EMAIL_FROM` 和 `ABUSE_HASH_SECRET`。缺少任一项时 `/api/health` 会返回 `ready=false`，防止没有投诉受理和防滥用能力的版本上线。

`VIDEO_DURATION_40_ENABLED=true` 开放 40 秒付费 Beta。关闭时前端不展示该规格，服务端 Preflight 和任务创建 API 也会拒绝新 40 秒任务；已创建任务不受开关回退影响。40 秒由 5 个独立 8 秒片段组成，消耗 310 点，免费试用仍仅支持 8 秒。

## 当前素材与模板边界

- 当前目录有 17 个模板。商品轻旋转/180° 和真人模特轻侧身/180° 均为付费 Beta、Advanced-only，并强制 Strict QA，不进入 Style Preset 自动编排。
- 商品旋转只接受无真人的同款商品多视角图，不会生成真人或虚拟模特。
- 真人模特转身要求同一可见真人穿着同一件服装的对应多视角图，并通过当前任务内的服装与模特一致性校验。单张正面真人图只能使用正面自然动作。
- 虚拟穿衣尚未接入；后续应作为独立上游模块实现，输出仍需通过一致性校验后才能复用真人模特模板。

## 完整生成链路

完整链路需要依次配置 Neon、Google OAuth、Resend、R2、Creem、DeepSeek、视觉模型、APIMart、Cloud Run 和 cron-job.org。先用 `/api/health` 检查配置，再创建真实测试任务。

## 素材授权与侵权处理

- 所有已登录用户的服务端上传都必须主动接受当前 `image_rights_v1` 声明；未勾选、版本过期或缺少声明时上传会被拒绝。
- 素材中有可识别真人时，上传者必须拥有肖像和商业宣传授权；未满 18 周岁还必须取得监护人授权。
- 公开侵权通知入口为 `/takedown`。提交只创建待核验案件，不会自动删除素材或视频。
- 管理员在 `/admin/rights-removal` 核验、处理并留下审计记录；只有 `admin` 可以结案，`operator` 只能分诊。
- `POST /api/internal/compliance/retention` 对三年前的声明和案件个人信息执行去标识化。生产环境应由 cron-job.org 每日调用，并发送 `Authorization: Bearer $CRON_JOB_SECRET`。

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
