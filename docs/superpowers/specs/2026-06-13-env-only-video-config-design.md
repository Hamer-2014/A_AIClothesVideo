# Env-only Video Generation Config Design

## 背景

当前视频生成链路曾被改为通过数据库读取模型路由和厂商密钥：

- `model_routes` 决定当前环境的 `capability/provider/model`。
- `provider_keys.encrypted_key` 存储厂商 API Key。
- 运行时通过 `resolveModelRoute()` 获取 provider、model 和解密后的 key。
- 后台存在 provider、model、key 切换能力。

这套设计适合更复杂的多 provider 运营场景，但对当前 MVP 和二次开发者并不友好。项目当前更需要降低配置入口数量，让开发者只看 `.env` 就能知道视频生成到底使用哪个厂商、哪个模型、哪个 key。

## 目标

视频生成运行时只读取环境变量，不再依赖数据库路由或数据库密钥。

标准配置入口：

```env
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6

APIMART_API_KEY=
APIMART_BASE_URL=https://api.apimart.ai

EVOLINK_API_KEY=
EVOLINK_BASE_URL=https://api.evolink.ai
```

完成后，本地开发者只需要在 `.env.local` 配置 provider、model 和对应 API key，即可触发视频生成。

## 非目标

本次不实现：

- 后台热切换模型。
- 后台维护厂商 API Key。
- 多环境数据库路由。
- 灰度路由。
- 自动 fallback 到另一个 provider。
- 按用户、任务或成本动态选择模型。

这些能力可以等项目进入多团队、多环境、多供应商运营阶段后另开设计。当前继续保留会让 MVP 的入门成本和排障成本偏高。

## 架构决策

视频生成采用 env-only 配置：

- `VIDEO_GENERATION_PROVIDER` 决定使用 `apimart` 或 `evolink`。
- `VIDEO_GENERATION_MODEL` 决定视频模型名。
- provider client 从各自的 env 读取 API key 和 base URL。
- `src/server/video/segments.ts` 不再调用 `resolveModelRoute()`。
- 运行时不再查询 `model_routes`。
- `provider_call_logs` 继续保留，用于排障、审计和成本追踪。
- 与 DB route 相关的 call log 字段应写 `null` 或保持为空，不再构造 route snapshot。
- health check 改为检查 env 配置，而不是检查 DB route/key。

## 数据库变更

必须删除：

- `model_routes` 表。
- `modelRoutes` schema 定义。
- `resolveModelRoute()` 的运行时依赖。

`model_providers` 和 `provider_keys` 的处理策略：

- 视频生成运行时必须完全不使用这两张表。
- 后台 provider key/route 管理能力应删除或隐藏，避免用户误以为后台配置仍然生效。
- 如果这两张表只服务后台切换密钥，可以在本次迁移中一并删除。
- 如果删除会牵连过多后台代码，可以第一阶段保留表但删除入口和 API，后续再做数据库清理。

本 SPEC 的硬性验收只要求删除 `model_routes`，并保证视频生成运行时不再使用数据库 provider key。

## 后台功能变更

取消或隐藏：

- provider key 管理页面。
- model route 管理页面。
- 激活路由、切换模型、切换 provider 的后台功能。
- 视频生成依赖 `PROVIDER_KEY_ENCRYPTION_SECRET` 的配置检查。

可以保留：

- job 状态查看。
- segment 状态查看。
- provider call logs。
- 错误详情。
- 重试入口。

## 代码修改范围

预计涉及：

- `src/server/video/segments.ts`
- `src/lib/providers/video-generation/router.ts`
- `src/lib/providers/apimart/video.ts`
- `src/lib/providers/evolink/video.ts`
- `src/server/providers/model-route-resolver.ts`
- `src/lib/db/schema/providers.ts`
- `src/server/ops/health.ts`
- `.env.example`
- 相关测试文件

要求：

- 删除 `resolveModelRoute()` 调用。
- provider client 恢复读取 env key。
- router 根据 `VIDEO_GENERATION_PROVIDER` 选择 provider。
- 缺少 provider、model 或 API key 时抛出清晰错误。
- 不再出现 `No active model route for video_generation in development`。
- 本地 `.env.local` 配置 key 后即可生成视频。

## 文档修改范围

需要同步更新：

- `docs/PRD.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_SPEC.md`
- `docs/API_TEST_STATUS.md`
- `docs/verification/model-route-audit-2026-06-12.md`
- `.env.example`

文档应明确：

- MVP 使用 env-only provider 配置。
- 数据库不保存和决定视频厂商 API Key。
- 后台不提供 provider、model、key 切换。
- 如果未来需要企业级多 provider 路由，应另开独立设计，不要在本次变更中保留半生效入口。

## 验收标准

完成后必须满足：

- 上传正面图、背面图、场景图，选择模板，点击生成视频，不再报 `No active model route for video_generation in development`。
- 本地只需要 `.env.local` 配置 provider、model、key。
- 不需要 `PROVIDER_KEY_ENCRYPTION_SECRET` 才能跑视频生成。
- `model_routes` 表被 migration 删除。
- 运行时代码不再查询 `model_routes`。
- `resolveModelRoute` 不再被视频生成链路引用。
- `modelRoutes` 不再从 schema 中导出。
- `npm run typecheck` 通过。
- 相关 vitest 通过。
- `.env.example` 展示完整 env-only 配置方式。
- PRD、技术架构、实施计划和开发验收文档与实际实现一致。

## 风险

- 删除 `model_routes` 是破坏性迁移，已有 route 数据会丢失。
- 如果后台页面或 API 仍引用旧表，会出现运行时错误，必须同步删除、隐藏或改成明确不可用。
- 如果 `.env.local` 缺少 key，视频生成会失败；错误必须清楚指出缺哪个变量。
- 如果生产环境以前依赖数据库 key，部署前必须把 key 转移到 Vercel 或对应运行平台的环境变量。

## 实施方式

本变更适合使用 subagent-driven development，但必须先有 implementation plan。建议拆分：

1. 恢复 provider client 和 router 的 env-only 行为。
2. 修改 segment 生成链路，移除 DB route 依赖。
3. 处理 schema、migration、后台 provider/route 清理。
4. 更新 health、env 示例和文档。
5. 由主控执行最终整合、测试和验收。

