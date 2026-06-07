# DeepSeek 分镜 API 设计

## 目标

实现用户选择可用镜头模板后生成 storyboard draft 的后台 API。当前阶段只生成和保存分镜草案，不确认分镜、不冻结点数、不创建视频 segment。

## 设计

- `src/lib/providers/deepseek/client.ts` 使用 DeepSeek OpenAI-compatible `/chat/completions`，默认 `https://api.deepseek.com` 和 `deepseek-v4-flash`。
- `src/server/storyboard/schema.ts` 校验 DeepSeek JSON：8/16/24 秒分别要求 1/2/3 个 8 秒 segment。
- `src/server/storyboard/generate.ts` 编排模板可用性校验、Creem Prompt Moderation、DeepSeek 调用、provider call log、storyboard 保存和 job 状态流转。
- `POST /api/jobs/[id]/storyboard` 接收 `selectedTemplateIds`、`userPrompt`、`isTrial`，返回 draft segments。
- `GET /api/jobs/[id]` 返回 `latestStoryboard`，便于 API 级验收。

## 规则

- DeepSeek 只能使用当前 job 的 `availableTemplateIds`。
- DeepSeek 返回的模板 ID 不在可用列表时拒绝保存。
- 用户自由文本必须先过 Creem Prompt Moderation。
- moderation `flag`、`deny`、`error` 都阻止 DeepSeek。
- DeepSeek 未配置或调用失败不伪造 storyboard。
- provider 成功但数据库保存失败时，不补写假的 DeepSeek failed 日志。

## 暂不做

- 不确认 storyboard。
- 不冻结点数。
- 不创建 `video_segments`。
- 不调用 EvoLink。
- 不做 UI。

## API 验收路径

1. `POST /api/jobs` 创建 job。
2. `POST /api/jobs/{jobId}/analyze` 或 worker tick 完成素材分析。
3. `GET /api/jobs/{jobId}` 确认 `recommendations.availableTemplateIds`。
4. `POST /api/jobs/{jobId}/storyboard` 生成分镜草案。
5. `GET /api/jobs/{jobId}` 查看 `latestStoryboard`。
