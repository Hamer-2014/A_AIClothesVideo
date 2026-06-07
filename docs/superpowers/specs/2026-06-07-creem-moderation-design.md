# Creem Prompt Moderation 设计

## 目标

接入 Creem `POST /v1/moderation/prompt`，作为用户输入、分镜 prompt 和最终视频 prompt 进入生成链路前的强制合规闸门。本阶段实现服务端客户端、结果持久化和可复用 `checkPrompt` 服务，不实现后台展示页面。

## 外部接口

- Endpoint：`POST /v1/moderation/prompt`
- Header：`x-api-key`
- Body：`prompt`、可选 `external_id`
- Decision：`allow`、`flag`、`deny`
- 规则：只有 `allow` 可继续；`flag` 按 `deny` 处理；超时、网络错误、5xx、缺 key 全部 fail closed。

## 本地边界

- `src/lib/providers/creem/moderation.ts`：Creem Moderation API client。
- `src/server/moderation/prompt-sources.ts`：定义 moderation source 枚举和摘要/hash 工具。
- `src/server/moderation/results.ts`：定义结果 store、memory store 和 Drizzle store。
- `src/server/moderation/check-prompt.ts`：服务端闸门，调用 Creem 并保存 `prompt_moderation_results`。

## 数据规则

- 每次检查都写 `prompt_moderation_results`。
- 保存 `promptHash` 和短摘要，不长期保存完整 prompt。
- 保存 user/job/segment/source/externalId/moderationId/decision/error/latency。
- `flag` 保存为 `flag`，但业务结果为 blocked。
- API 错误保存为 `error`，业务结果为 blocked。

## 暂不做

- 不做后台 moderation 列表页。
- 不做人工 override。
- 不做内容安全图片审核。
- 不做 DeepSeek/视频生成链路集成，后续在分镜确认和最终 prompt 阶段调用本服务。

## 验收

- allow 返回 allowed。
- flag/deny 返回 blocked。
- API 失败、缺 key、网络错误返回 blocked。
- 每次调用保存结果。
- 不保存完整 prompt。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 通过。
