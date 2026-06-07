# R2 上传与文件访问里程碑设计

## 范围

本阶段实现 `DEVELOPMENT_SPEC.md` 第 7 章的基础能力：Cloudflare R2 S3-compatible client、对象 key 规则、文件类型/大小校验、上传 presigned URL、下载 signed URL helper、创建 `assets` 记录。

本阶段不做前台上传 UI，不生成缩略图，不做异步清理，不接视觉分析。缩略图和清理任务放到后续 worker/素材分析阶段。

## 架构

R2 使用 AWS SDK v3：

- `src/lib/storage/r2-client.ts`：读取 R2 环境变量，创建 S3 client。缺配置 fail closed。
- `src/lib/storage/keys.ts`：集中生成 R2 key，不允许页面或 API 手写路径。
- `src/lib/storage/validation.ts`：校验上传文件类型、扩展名和大小。
- `src/lib/storage/presign.ts`：生成 PutObject 和 GetObject signed URL。
- `src/app/api/uploads/presign/route.ts`：登录用户请求上传授权，并创建 `assets` 记录。
- `src/app/api/files/signed-url/route.ts`：登录用户请求文件下载 URL。

R2 bucket 必须保持私有。数据库只保存 R2 key，不保存永久公开 URL。

## 认证与权限

上传授权必须有登录 session。`/api/uploads/presign` 从 server session 获取 user id，不接受前端传入 userId。

用户下载文件时必须校验 `assets.user_id` 归属。管理员访问文件后续接后台权限，本阶段先不开放管理员文件 API。

## 文件限制

MVP 首批允许图片：

- `image/jpeg`
- `image/png`
- `image/webp`

默认最大 15MB。超出或未知类型直接拒绝。

## 路径规则

本阶段实现：

```text
users/{userId}/assets/{assetId}/original.{ext}
users/{userId}/assets/{assetId}/thumb.webp
jobs/{jobId}/segments/{segmentId}/video.mp4
jobs/{jobId}/stitched/final.mp4
jobs/{jobId}/qa/frames/{frameIndex}.jpg
jobs/{jobId}/covers/cover.webp
```

路径不以 `/` 开头，避免 S3 key 混乱。

## 测试

Vitest 覆盖：

- R2 env 缺失 fail closed。
- 文件类型和大小校验。
- key 生成稳定。
- presign helper 调用正确 command。
- presign API 未登录返回 401。

真实 R2 上传/下载需人工或集成测试验证，因为 signed URL 要由浏览器/HTTP 客户端实际 PUT 文件。

## 风险

当前认证阶段已实现 helper，但还未完成真实浏览器 OAuth/OTP 手工验收。本阶段 API 会严格要求 session；如果本地还没登录成功，调用 presign 会返回 401，这是正确行为。
