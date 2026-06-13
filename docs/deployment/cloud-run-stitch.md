# Cloud Run Stitch Worker 部署入口

本文档是 `stitch-worker` 的部署入口。源码位于 `workers/stitch-worker/`，主应用触发代码位于 `src/server/stitch/trigger-cloud-run.ts`。

## 目录边界

```text
src/
  server/stitch/trigger-cloud-run.ts  # Next.js 主应用触发 Cloud Run
workers/
  stitch-worker/                      # Cloud Run 独立服务，包含 Dockerfile 和 ffmpeg worker 源码
docs/
  deployment/cloud-run-stitch.md      # 本部署入口
```

规则：

- `src/` 属于 Next.js/Vercel 主应用。
- `workers/stitch-worker/` 属于 Cloud Run，不放进 Next.js 运行时。
- Cloud Run 构建上下文必须使用 `workers/stitch-worker`，不要从仓库根目录构建镜像。
- Vercel 不执行 ffmpeg。

## 服务接口

Cloud Run worker 暴露：

- `GET /health`：健康检查。
- `POST /stitch`：执行单个 stitch job。

`POST /stitch` 必须带内部密钥：

```http
x-worker-secret: <CLOUD_RUN_STITCH_SECRET>
content-type: application/json
```

请求体：

```json
{
  "stitchJobId": "stitch-job-id",
  "videoJobId": "video-job-id",
  "segmentKeys": ["jobs/video-job-id/segments/segment-id/video.mp4"],
  "finalVideoKey": "jobs/video-job-id/stitched/final.mp4",
  "coverKey": "jobs/video-job-id/covers/cover.webp",
  "frameKeyPrefix": "jobs/video-job-id/qa/frames",
  "postQaMode": "standard",
  "callbackUrl": "https://app.example.com/api/internal/stitch/callback"
}
```

worker 完成后回调主应用：

```text
POST /api/internal/stitch/callback
```

回调同样使用 `x-worker-secret`，但值必须是主应用的 `INTERNAL_WORKER_SECRET`。
不要把它和触发 Cloud Run 的 `CLOUD_RUN_STITCH_SECRET` 混为一谈：

- `CLOUD_RUN_STITCH_SECRET`：主应用 -> Cloud Run `/stitch`
- `INTERNAL_WORKER_SECRET`：Cloud Run -> 主应用 `/api/internal/stitch/callback`

## 必需环境变量

主应用：

```env
APP_URL=https://app.example.com
CLOUD_RUN_STITCH_URL=https://stitch-worker-xxxxx-region.a.run.app
CLOUD_RUN_STITCH_SECRET=
INTERNAL_WORKER_SECRET=
```

Cloud Run worker：

```env
CLOUD_RUN_STITCH_SECRET=
INTERNAL_WORKER_SECRET=
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=
```

也可以用 `CLOUDFLARE_R2_ENDPOINT` 覆盖默认 endpoint。

## GCP 初始化

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region us-central1

gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```

## 创建 Artifact Registry

```bash
REGION=us-central1
PROJECT_ID=YOUR_PROJECT_ID
REPO=runwaytools

gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="A RunwayTools containers"

gcloud auth configure-docker $REGION-docker.pkg.dev
```

## 创建 Secret Manager 密钥

```bash
echo -n "your-worker-secret" | gcloud secrets create cloud-run-stitch-secret --data-file=-
echo -n "your-main-app-internal-worker-secret" | gcloud secrets create internal-worker-secret --data-file=-
echo -n "your-r2-access-key-id" | gcloud secrets create r2-access-key-id --data-file=-
echo -n "your-r2-secret-access-key" | gcloud secrets create r2-secret-access-key --data-file=-
```

## 构建镜像

必须从 worker 目录作为上下文构建：

```bash
REGION=us-central1
PROJECT_ID=YOUR_PROJECT_ID
REPO=runwaytools
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/stitch-worker:$(git rev-parse --short HEAD)"

gcloud builds submit workers/stitch-worker --tag "$IMAGE"
```

## GitHub 自动部署配置

项目已提供 Cloud Build 配置文件：

```text
cloudbuild.stitch-worker.yaml
```

在 Cloud Build Trigger 页面填写：

```text
Build configuration: Cloud Build configuration file
Location: Repository
Cloud Build configuration file location: cloudbuild.stitch-worker.yaml
```

该配置会：

1. 使用 `workers/stitch-worker` 作为 Docker build context。
2. 推送镜像到 Artifact Registry。
3. 部署 Cloud Run service `stitch-worker`。

注意：该文件只负责构建、推镜像和部署 revision。Cloud Run 的 Secret、R2 环境变量和 Secret Manager 权限仍按下方部署步骤或 Cloud Run 控制台配置。不要把密钥写进 `cloudbuild.stitch-worker.yaml`。

## 部署 Cloud Run

MVP 可以先用 `--allow-unauthenticated` 加 `x-worker-secret`。上线前如需更严格，可以改为 Cloud Run IAM Invoker + OIDC。

```bash
gcloud run deploy stitch-worker \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 1 \
  --max-instances 3 \
  --set-env-vars "CLOUDFLARE_R2_ACCOUNT_ID=your-account-id,CLOUDFLARE_R2_BUCKET=your-bucket" \
  --set-secrets "CLOUD_RUN_STITCH_SECRET=cloud-run-stitch-secret:latest,INTERNAL_WORKER_SECRET=internal-worker-secret:latest,CLOUDFLARE_R2_ACCESS_KEY_ID=r2-access-key-id:latest,CLOUDFLARE_R2_SECRET_ACCESS_KEY=r2-secret-access-key:latest"
```

获取 URL：

```bash
gcloud run services describe stitch-worker \
  --region "$REGION" \
  --format="value(status.url)"
```

将返回值配置到主应用 `CLOUD_RUN_STITCH_URL`。

## 验收清单

- [ ] `GET {CLOUD_RUN_STITCH_URL}/health` 返回 `200`。
- [ ] 主应用 `APP_URL` 是公网可访问域名。
- [ ] 主应用 `CLOUD_RUN_STITCH_URL` 指向 Cloud Run service。
- [ ] 主应用的 `CLOUD_RUN_STITCH_SECRET` 和 Cloud Run 的 `CLOUD_RUN_STITCH_SECRET` 一致。
- [ ] Cloud Run 的 `INTERNAL_WORKER_SECRET` 和主应用的 `INTERNAL_WORKER_SECRET` 一致。
- [ ] R2 中存在测试 segment 视频。
- [ ] `POST /api/internal/stitch/jobs` 能创建 stitch job 并触发 Cloud Run。
- [ ] Cloud Run 日志能看到 ffmpeg 执行。
- [ ] R2 出现 `jobs/{jobId}/stitched/final.mp4`。
- [ ] R2 出现 `jobs/{jobId}/qa/frames/{index}.jpg`。
- [ ] 主应用收到 `/api/internal/stitch/callback` 并更新状态。

## Smoke Test

准备一个已经进入 `segment_succeeded` 且所有 `video_segments.video_key` 都存在于 R2 的任务，然后运行：

```bash
APP_URL=https://app.example.com \
CLOUD_RUN_STITCH_URL=https://stitch-worker-xxxxx-region.a.run.app \
INTERNAL_WORKER_SECRET=your-main-app-internal-worker-secret \
JOB_ID=your-video-job-id \
npm run smoke:stitch
```

成功后继续检查：

- Cloud Run 日志中出现 ffmpeg 执行记录。
- R2 中出现 `jobs/{jobId}/stitched/final.mp4`。
- R2 中出现 `jobs/{jobId}/qa/frames/0.jpg` 等抽帧。
- 主应用任务状态从 `stitching_running` 进入 `post_qa_queued`。

如需继续把后端链路追到 Post-QA 终态，再运行：

```bash
APP_URL=https://app.example.com \
DATABASE_URL=postgres://... \
CLOUD_RUN_STITCH_URL=https://stitch-worker-xxxxx-region.a.run.app \
INTERNAL_WORKER_SECRET=your-main-app-internal-worker-secret \
CRON_JOB_SECRET=your-cron-secret \
CLOUDFLARE_R2_ACCOUNT_ID=... \
CLOUDFLARE_R2_ACCESS_KEY_ID=... \
CLOUDFLARE_R2_SECRET_ACCESS_KEY=... \
CLOUDFLARE_R2_BUCKET=... \
JOB_ID=your-video-job-id \
npm run smoke:backend
```

`smoke:backend` 会额外检查：

- 数据库中的 `video_jobs` / `stitch_jobs` / `post_qa_results` 最终状态
- `credit_ledger` 是否出现 `capture`
- R2 最终视频与 QA frames 是否都存在

## 当前限制

- worker 不主动轮询数据库，只执行主应用触发的单个 job。
- 当前封面 key 会随 callback 传递，但封面生成尚未单独实现；最终视频和 QA frames 是本阶段核心输出。
- 抽帧已按 `postQaMode` 分级：`off = 0`、`lite = 3`、`standard = 5`、`strict = 6`。strict 后续仍可扩展转场帧策略。
