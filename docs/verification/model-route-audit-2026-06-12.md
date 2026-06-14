# 模型路由审计记录

日期：2026-06-12

## 结论

> 2026-06-13 更新：本审计中的 DB model route 方案已被 Env-only Video Generation Config 取代。MVP 视频生成 provider/model/key 只读取 `.env.local` / 部署平台环境变量：`VIDEO_GENERATION_PROVIDER`、`VIDEO_GENERATION_MODEL`、当前 provider 对应的 `APIMART_API_KEY` 或 `EVOLINK_API_KEY`。`model_routes` / `provider_keys` 不再决定公开视频生成运行时配置，`PROVIDER_KEY_ENCRYPTION_SECRET` 也不是视频生成必需项。

当前最新决策：由于 EvoLink Veo 稳定性不足，公开视频生成默认先试用：

- Provider：`apimart`
- Model：`pixverse-v6`

EvoLink `veo3.1-fast-beta` 暂时降为备用/对照路线。这个决策牺牲了部分成本确定性换稳定性，因此必须单独跟踪 PixVerse 的任务成本、成功率和毛利。

## 本次触发审计的证据

Paid closure 验收中出现两个真实付费样本：

| Job | 结果 | 视频生成 provider/model | 说明 |
| --- | --- | --- | --- |
| `5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06` | `deliverable` | `apimart` / `pixverse-v6` | 账务闭环通过，且可作为 PixVerse 默认路线的既有成功样本 |
| `b207d897-04dd-41cc-b1a8-02b56a6cc3a1` | `failed_released` | `evolink` / `veo3.1-pro-beta` | 失败补偿闭环通过，但该模型成本过高，不再作为默认方向 |

因此 paid closure 可以证明账务和补偿闭环；其中 paid delivery 样本也证明 PixVerse 可完成一次真实交付。但它仍不能证明 PixVerse 在规模化任务中的稳定性和毛利。

## 根因

本节为历史记录，已废弃。曾经的收敛方案是让公开视频生成的 provider/model/key 以数据库为准：

- `model_routes` 决定 `video_generation` 使用的 provider 和 model。
- `provider_keys.encrypted_key` 保存厂商 API key。
- 运行时用 `PROVIDER_KEY_ENCRYPTION_SECRET` 解密 provider key。
- `.env` 不再保存 `APIMART_API_KEY`、`EVOLINK_API_KEY` 或视频生成模型变量。

当前 MVP 正确做法相反：在 `.env.local` / 部署平台环境变量中配置：

```text
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6
APIMART_API_KEY=<provider key>
APIMART_BASE_URL=https://api.apimart.ai

EVOLINK_API_KEY=<provider key if using evolink>
EVOLINK_BASE_URL=https://api.evolink.ai
```

不要再依赖 `model_routes` / `provider_keys` 配置公开视频生成。

历史 DB-route 方案曾要求本地真实验收环境只保留非密钥 endpoint 与解密 secret：

```text
APIMART_BASE_URL=https://api.apimart.ai
EVOLINK_BASE_URL=https://api.evolink.ai
PROVIDER_KEY_ENCRYPTION_SECRET=<local secret>
```

当前 env-only 方案下，paid delivery 样本走 APIMart/PixVerse 的依据应来自环境变量、`video_segments.provider/model` 和 `provider_call_logs.provider/model`，不是 route snapshot。

## 已收敛项

- PRD、技术架构、实现计划、开发 SPEC 中公开视频主模型已统一为 APIMart `pixverse-v6`。
- 路由代码不再通过 `model_routes` 选择公开视频 provider/model。
- 测试样例应覆盖 env-only provider/model/key 检查。
- 本地 `.env.local` 应调整为：

```text
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6
APIMART_API_KEY=<local provider key>
APIMART_BASE_URL=https://api.apimart.ai
```

注意：`.env.local` 不进入 Git。Vercel、staging、production 环境变量需要人工同步检查。

## 必须同步检查的环境变量

在所有公开视频环境中确认：

```text
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6
APIMART_API_KEY=<configured>
APIMART_BASE_URL=https://api.apimart.ai
```

备用 provider key 不再进入 `provider_keys` 决定公开视频生成；切换 provider 时通过环境变量调整 `VIDEO_GENERATION_PROVIDER` 和对应 key。

## 后续验收方法

下一次 paid delivery smoke 不能只看账务，还要检查 provider：

```bash
npm run smoke:backend -- --job-id <paid-pixverse-job-id>
node scripts/generation-debug.mjs <paid-pixverse-job-id> status
```

必须看到：

- `video_jobs.status = deliverable`
- `credit_ledger` 包含 `reserve` 和 `capture`
- `video_segments.provider = apimart`
- `video_segments.model = pixverse-v6`
- `provider_call_logs.purpose = video_generation`
- `provider_call_logs.provider = apimart`
- `provider_call_logs.model = pixverse-v6`

## 剩余风险

- `verify:blockers` 已在 2026-06-13 加入 paid delivery 的 provider/model 断言，要求公开视频付费交付样本包含 `apimart` / `pixverse-v6` 证据。它可以发现已交付样本跑错模型，但仍不能替代生产环境变量发布前检查。
- `model_routes` 属于历史 DB-route 方案；当前 MVP 运行时不应依赖它决定公开视频生成 provider/model/key。
- 如果后续要允许后台切换模型路线，必须先加入“公开/备用/管理员任务”的路由隔离规则，并让 smoke 明确断言 provider/model。

## 2026-06-13 本地稳定性补充

- 开发者本地已生成 10+ 个视频，当前判断 APIMart PixVerse V6 链路稳定。
- 该结论可降低公开视频默认路线的技术风险，但仍需继续记录真实 SKU、耗时、失败率、重试率和单任务毛利。
