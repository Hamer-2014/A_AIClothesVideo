# API 测试状态清单

> 目的：把“已经真实验证过什么、只做了单测什么、还没跑什么”说清楚，避免误判开发完成度。

更新时间：2026-06-09

## 结论先说

- 后台与内部 API 的代码面已经基本齐了。
- 真实端到端已经验证过的是 `stitch -> callback -> post_qa_queued` 这段主链路。
- Post-QA 代码与测试是有的，但你我还没完成“生产环境下真实 provider 跑到 deliverable”的一次完整 smoke 留痕。
- 这就是接下来优先要补的，不要被“接口都在”骗了。

## 已做真实链路验证

### 1. Cloud Run stitch 主链路

已验证内容：

- `GET {CLOUD_RUN_STITCH_URL}/health`
- `POST /api/internal/stitch/jobs`
- Cloud Run 下载 R2 segment
- ffmpeg 拼接
- R2 上传 `jobs/{jobId}/stitched/final.mp4`
- R2 上传 `jobs/{jobId}/qa/frames/*.jpg`
- `POST /api/internal/stitch/callback`
- `video_jobs.status -> post_qa_queued`

已知真实样本：

- `jobId = e204403f-8bd0-4496-8089-1532cdfbdac7`
- `stitchJobId = 67a1d931-dfd5-4266-9b63-96e92be22952`
- 结果状态：
  - `video_jobs.status = post_qa_queued`
  - `stitch_jobs.status = succeeded`

R2 已确认对象：

- `jobs/e204403f-8bd0-4496-8089-1532cdfbdac7/stitched/final.mp4`
- `jobs/e204403f-8bd0-4496-8089-1532cdfbdac7/qa/frames/0.jpg`
- `jobs/e204403f-8bd0-4496-8089-1532cdfbdac7/qa/frames/1.jpg`
- `jobs/e204403f-8bd0-4496-8089-1532cdfbdac7/qa/frames/2.jpg`

## 已有自动化测试覆盖

### 用户侧 API

| API | 自动化状态 | 备注 |
| --- | --- | --- |
| `POST /api/uploads/presign` | 已有测试 | 接口级 |
| `GET /api/files/signed-url` | 已有测试 | 接口级 |
| `POST /api/jobs` | 已有测试 | 接口级 |
| `GET /api/jobs/[id]` | 已有测试 | 接口级 |
| `POST /api/jobs/[id]/analyze` | 已有测试 | 接口级 |
| `POST /api/jobs/[id]/storyboard` | 已有测试 | 接口级 |
| `POST /api/jobs/[id]/confirm` | 已有测试 | 接口级 |
| `GET /api/jobs/[id]/progress` | 已有测试 | 接口级 |

### 内部 API

| API | 自动化状态 | 备注 |
| --- | --- | --- |
| `POST /api/internal/worker/tick` | 已有测试 | 包括 staged result 返回 |
| `POST /api/internal/segments/[id]/submit` | 已有测试 | 接口级 |
| `POST /api/internal/segments/[id]/poll` | 已有测试 | 接口级 |
| `POST /api/internal/stitch/jobs` | 已有测试 | 接口级 |
| `POST /api/internal/stitch/callback` | 已有测试 | 接口级 |
| `POST /api/internal/post-qa/resolve` | 已有测试 | 接口级 |

### 后台运维 API

| API | 自动化状态 | 备注 |
| --- | --- | --- |
| `GET /api/admin/jobs/[id]` | 已有测试 | 接口级 |
| `POST /api/admin/templates/status` | 已有测试 | 接口级 |
| `GET /api/admin/providers` | 已有测试 | 接口级 |
| `POST /api/admin/provider-keys/[id]/status` | 已有测试 | 接口级 |
| `POST /api/admin/model-routes/[id]` | 已有测试 | 接口级 |
| `GET /api/admin/billing` | 已有测试 | 接口级 |
| `POST /api/admin/credits/adjust` | 已有测试 | 接口级 |
| `POST /api/admin/segments/[id]/retry` | 已有测试 | 接口级 |
| `POST /api/admin/jobs/[id]/undeliverable` | 已有测试 | 接口级 |

### 服务层 / 核心逻辑

| 模块 | 自动化状态 | 备注 |
| --- | --- | --- |
| 模板规则引擎 | 已有测试 | catalog/rules/recommend/seed/status |
| stitch job 创建与回调 | 已有测试 | `src/server/stitch/*.test.ts` |
| Post-QA job input / check / resolve / tick | 已有测试 | `src/server/post-qa/*.test.ts` |
| admin job actions | 已有测试 | 重试片段、标记不可交付 |
| provider ops | 已有测试 | key/route 状态运维 |
| billing ops | 已有测试 | 补点、账本视图 |
| `/api/health` 运行时检查 | 已补测试 | 本轮新增 |

## 已补但尚未完成真实 smoke 的内容

### 1. 完整后端冒烟脚本

脚本：

- `npm run smoke:backend`
- `npm run smoke:stitch`

用途：

- `smoke:stitch` 只验证 stitch 到 `post_qa_queued`
- `smoke:backend` 继续追到 Post-QA 终态，并检查 R2、数据库、账本

现状：

- 脚本已补。
- 还没在你当前真实环境上重新跑出一份新的完整结果留档。

### 2. `/api/health` 运维视图

现状：

- 已从简单 ping 扩展为 runtime readiness 视图。
- 会按模块报告缺失配置：
  - database
  - auth
  - storage
  - internalSecurity
  - stitchWorker
  - billing
  - aiProviders

限制：

- 这是“配置就绪度”，不是外部依赖的真实联通性探针。
- 它不会去真的连数据库、调用 Creem、探测 DeepSeek。
- 这是有意保守设计，避免 health 接口自己变成高风险慢接口。

## 尚未完成的真实验证

下面这些不能自称“已验收”：

| 项目 | 当前状态 | 风险 |
| --- | --- | --- |
| Post-QA 使用真实视觉 provider 跑到 `deliverable` | 未留存完整 smoke 结果 | 可能在 provider schema、signed URL、capture 上翻车 |
| `failed_released` 真实失败回路演练 | 未完整留档 | 退款/释放和状态切换可能有边角问题 |
| Creem moderation 拦截真实 case | 未做完整生产链路回放 | 可能只在单测里对 |
| 16/24 秒多 segment 到完整交付 | stitch 主链路做过，但未形成完整最终验收清单 | 并发/顺序/账务仍需盯 |
| 运维 API 联合演练 | 未做系统化脚本 | 单接口能用不等于整套运维流程顺手 |

## 推荐验收顺序

1. 先跑 `GET /api/health`
2. 跑 `npm run smoke:stitch`
3. 跑 `npm run smoke:backend`
4. 查数据库：
   - `video_jobs`
   - `stitch_jobs`
   - `post_qa_results`
   - `credit_ledger`
5. 查 R2：
   - `stitched/final.mp4`
   - `qa/frames/*`
6. 最后再演练后台运维 API

## 这份清单真正想防的坑

最大的坑不是 bug，本质上是错觉：

- “有 route 文件了，所以功能完成了”
- “单测过了，所以生产能跑”
- “之前某次跑通过，所以现在也一定没问题”

这些都不成立。后面你验收后台 API，优先看 smoke 结果和真实状态，不要被接口列表麻痹。
