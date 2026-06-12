# 模型路由审计记录

日期：2026-06-12

## 结论

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

本次最新收敛后，代码默认行为与 `.env.example` 均偏向 APIMart PixVerse：

- `VIDEO_GENERATION_PROVIDER` 未配置时默认 `apimart`。
- APIMart 模型默认值为 `pixverse-v6`。
- `.env.example` 中 `VIDEO_GENERATION_PROVIDER=apimart`。
- `.env.example` 中 `VIDEO_GENERATION_MODEL=pixverse-v6`。

本地真实验收环境曾被 `.env.local` 覆盖为：

```text
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6
```

这解释了 paid delivery 样本为什么走 APIMart/PixVerse。该路线现在被接受为默认试用路线，但必须继续验证毛利。

## 已收敛项

- PRD、技术架构、实现计划、开发 SPEC 中公开视频主模型已统一为 APIMart `pixverse-v6`。
- 路由代码未显式配置 provider 时默认选择 `apimart`。
- 测试样例已覆盖 APIMart 默认路由。
- 本地 `.env.local` 已调整为：

```text
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6
```

注意：`.env.local` 不进入 Git。Vercel、staging、production 环境变量需要人工同步检查。

## 必须同步检查的环境变量

在所有公开视频环境中确认：

```text
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6
APIMART_PIXVERSE_MODEL=pixverse-v6
```

可以保留 EvoLink key 作为备用，但不要把默认 provider 切回 EvoLink，除非已经重新验收稳定性和成本：

```text
EVOLINK_API_KEY=<optional fallback candidate>
EVOLINK_VIDEO_MODEL=veo3.1-fast-beta
```

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

- `verify:blockers` 目前只验证商业闭环证据，不验证具体视频 provider/model。它不能防止环境误配导致公开视频任务走错 provider。
- `model_routes` 表已经存在，但公开视频生成运行时代码当前主要读取环境变量，而不是强制读取数据库路由表。
- 如果后续要允许后台切换模型路线，必须先加入“公开/备用/管理员任务”的路由隔离规则，并让 smoke 明确断言 provider/model。
