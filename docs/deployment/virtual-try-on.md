# 虚拟试穿部署

虚拟试穿是 Next.js 内部 worker，不属于 Cloud Run `stitch-worker`。部署前先执行未发布的 `drizzle/0020_virtual_tryon.sql`，并在 Vercel 配置 `APIMART_BASE_URL=https://api.apimart.ai`、`APIMART_API_KEY`、`CLOUDFLARE_R2_ACCOUNT_ID`、`CLOUDFLARE_R2_ACCESS_KEY_ID`、`CLOUDFLARE_R2_SECRET_ACCESS_KEY`、`CLOUDFLARE_R2_BUCKET`、`VIRTUAL_TRYON_MODEL_BASE_KEY`、两项正整数价格变量、`VISION_PROVIDER`、`VISION_API_KEY`、`VISION_MODEL_STRICT`（非 OpenAI 还须 `VISION_BASE_URL`）和可用的 Creem moderation 配置。`VIRTUAL_TRYON_MODEL_BASE_KEY` 指向同时包含 `front.png`、`side.png`、`back.png` 的私有 R2 目录，例如 `models/virtual-try-on/default-v1`。可选 `APIMART_IMAGE_OUTPUT_HOST_ALLOWLIST` 只允许受控供应商输出域名；空值仅允许 `upload.apimart.ai`。

在 cron-job.org 每分钟请求 `POST https://<app>/api/internal/virtual-try-on/tick`，使用 `Authorization: Bearer <CRON_JOB_SECRET>` 或 `x-cron-secret: <CRON_JOB_SECRET>`；body 默认可为空，单次只推进一个原子步骤。可显式传 `{ "limit": 1..20 }`，但不要把该 cron 混进 Cloud Run 视频拼接流程。

上线验收：确认私有 R2 preview/download 可由 owner 使用、provider call logs 没有 URL 或密钥、撤权/删除后立即 404、`front_only` 无 cross QA、三视图严格遵循 front-to-side-to-back 链。平台 AI 模特的商业授权、肖像/合成来源与适用地域须由发布负责人保存人工证据；R2 key 不是授权证明。当前撤权只立即禁止交付，不宣称已存在可靠异步物理 R2 删除队列。

真实 smoke 仅在 staging 以 `APP_ENV=staging VIRTUAL_TRYON_SMOKE_ACKNOWLEDGE_COST=true pnpm run smoke:virtual-try-on` 执行；它会明确跳过缺少输入或密钥的环境，不打印 cookie、URL、R2 key、provider raw 或 API key。
