# 模型路由审计记录

日期：2026-06-12

## 结论

当前公开视频生成主链路应收敛为：

- Provider：`evolink`
- Model：`veo3.1-fast-beta`

APIMart `pixverse-v6` 只能作为管理员内测/实验路线，不应作为普通公开视频生成任务的默认 provider，也不应进入公开自动 fallback。

## 本次触发审计的证据

Paid closure 验收中出现两个真实付费样本：

| Job | 结果 | 视频生成 provider/model | 说明 |
| --- | --- | --- | --- |
| `5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06` | `deliverable` | `apimart` / `pixverse-v6` | 账务闭环通过，但公开视频模型路线偏离 PRD |
| `b207d897-04dd-41cc-b1a8-02b56a6cc3a1` | `failed_released` | `evolink` / `veo3.1-pro-beta` | 失败补偿闭环通过，但模型成本过高 |

因此 paid closure 可以证明账务和补偿闭环，但不能证明公开视频默认模型路线已经正确。

## 根因

代码默认行为与 `.env.example` 已经偏向 EvoLink fast：

- `VIDEO_GENERATION_PROVIDER` 未配置时默认 `evolink`。
- EvoLink 模型默认值为 `veo3.1-fast-beta`。
- `.env.example` 中 `VIDEO_GENERATION_PROVIDER=evolink`。
- `.env.example` 中 `VIDEO_GENERATION_MODEL=veo3.1-fast-beta`。

本地真实验收环境曾被 `.env.local` 覆盖为：

```text
VIDEO_GENERATION_PROVIDER=apimart
VIDEO_GENERATION_MODEL=pixverse-v6
```

这导致 paid delivery 样本走了 APIMart/PixVerse。该问题不是账务链路 bug，而是运行环境路由配置偏离产品策略。

## 已收敛项

- PRD、技术架构、实现计划、开发 SPEC 中公开视频主模型已统一为 `veo3.1-fast-beta`。
- 测试样例中的 EvoLink 默认/示例模型已统一为 `veo3.1-fast-beta`。
- 本地 `.env.local` 已调整为：

```text
VIDEO_GENERATION_PROVIDER=evolink
VIDEO_GENERATION_MODEL=veo3.1-fast-beta
```

注意：`.env.local` 不进入 Git。Vercel、staging、production 环境变量需要人工同步检查。

## 必须同步检查的环境变量

在所有公开视频环境中确认：

```text
VIDEO_GENERATION_PROVIDER=evolink
VIDEO_GENERATION_MODEL=veo3.1-fast-beta
EVOLINK_VIDEO_MODEL=veo3.1-fast-beta
```

如果配置了 APIMart key，也不能把公开视频 provider 切成 APIMart：

```text
APIMART_API_KEY=<可以存在，仅限内测>
APIMART_PIXVERSE_MODEL=pixverse-v6
```

## 后续验收方法

下一次 paid delivery smoke 不能只看账务，还要检查 provider：

```bash
npm run smoke:backend -- --job-id <paid-evolink-fast-job-id>
node scripts/generation-debug.mjs <paid-evolink-fast-job-id> status
```

必须看到：

- `video_jobs.status = deliverable`
- `credit_ledger` 包含 `reserve` 和 `capture`
- `video_segments.provider = evolink`
- `video_segments.model = veo3.1-fast-beta`
- `provider_call_logs.purpose = video_generation`
- `provider_call_logs.provider = evolink`
- `provider_call_logs.model = veo3.1-fast-beta`

## 剩余风险

- `verify:blockers` 目前只验证商业闭环证据，不验证具体视频 provider/model。它不能防止环境误配导致公开视频任务走 APIMart。
- `model_routes` 表已经存在，但公开视频生成运行时代码当前主要读取环境变量，而不是强制读取数据库路由表。
- 如果后续要允许后台切换模型路线，必须先加入“公开/内测/管理员任务”的路由隔离规则，并让 smoke 明确断言 provider/model。

