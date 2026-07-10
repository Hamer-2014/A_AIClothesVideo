# README、40 秒 Beta 与旋转模板设计

日期：2026-07-10
状态：用户确认稿
关联文档：[PRD](../../PRD.md)、[技术架构](../../TECHNICAL_ARCHITECTURE.md)、[实施计划](../../IMPLEMENTATION_PLAN.md)、[开发 SPEC](../../DEVELOPMENT_SPEC.md)、[Style Preset 设计](../../STYLE_PRESET_DESIGN.md)

## 1. 目标

本设计覆盖三个相互关联、但需要分阶段交付的目标：

1. 新增根目录 `README.md`，让开发者能够快速完成本地环境配置、启动主应用，并按需接入完整生成链路。
2. 新增 40 秒付费 Beta 规格，由 5 个独立 8 秒片段生成并拼接，定价 310 点。
3. 新增商品旋转和真人模特转身能力，并为后续虚拟穿衣模块保留清晰的上游接入边界。

核心产品方向不是限制模特视频，而是根据素材能力选择正确的生成路径：

```text
已有真人模特穿着图 -> 直接生成模特动作视频
只有商品图         -> 当前生成商品展示视频
只有商品图但需要模特 -> 后续显式进入虚拟穿衣模块
```

禁止让视频模型在只有商品图时隐式生成真人或完成不可审计的虚拟穿衣。

## 2. 已确认产品决策

- 采用分阶段、共享底层能力的交付路线。
- 40 秒作为普通付费用户可选的 Beta 规格，不开放免费试用。
- 40 秒由 `5 x 8 秒` 片段组成，价格为 310 点。
- 40 秒包含 Strict QA 时，Beta 阶段暂不额外加价；后台必须记录真实 QA 成本。
- 商品旋转与模特转身使用独立模板 ID，底层可以共享多图输入、运动参数和 QA 调度。
- 已有真人模特穿着图时，允许生成真人自然姿态、轻侧身和满足素材条件的 180 度转身视频。
- 只有商品图时，当前阶段只生成商品展示；不得隐式创造真人。
- 虚拟穿衣作为后续独立模块。其产出的多角度虚拟模特图通过一致性检查后，复用现有模特视频模板。
- 用户最新要求覆盖现有文档中“只支持 8/16/24 秒”和“MVP 不做转身”的旧边界。

## 3. 分阶段交付

### 3.1 阶段 A：开发启动基础

- 创建根目录 `README.md`。
- 修正 `.env.example` 的缺失项和环境说明。
- 根项目统一使用 pnpm，消除根目录双 lockfile。
- 修正主仓库和 `.worktree/*` 两种路径下的 Turbopack root 推断。
- 建立统一视频规格配置，消除前后端重复的时长、片段数和价格判断。

### 3.2 阶段 B：商品旋转与 40 秒 Beta

- 新增 `product_quarter_rotation`。
- 新增 `product_half_rotation`。
- 新增商品多图一致性检查。
- 新增 40 秒选择、预检、分镜、计费、进度、拼接和 QA 支持。

### 3.3 阶段 C：已有真人模特转身

- 新增 `model_quarter_turn`。
- 新增 `model_half_turn`。
- 新增模特多图一致性检查。
- 允许已有真人模特素材使用正面自然姿态、轻侧身和转身类视频模板。

### 3.4 后续阶段：虚拟穿衣

虚拟穿衣不纳入前三阶段的实现范围。后续独立设计以下链路：

```text
商品图
-> 用户选择虚拟模特类型或上传合法模特参考
-> 生成虚拟试穿正面图
-> 用户确认
-> 生成同一虚拟模特的侧面和背面图
-> 跨视角一致性检查
-> 复用 model_* 视频模板
```

## 4. README 与环境配置设计

### 4.1 README 结构

根目录 `README.md` 按以下顺序组织：

1. 产品定位和系统架构边界。
2. 前置要求。
3. 5 分钟启动主应用。
4. 环境变量分组和获取位置。
5. 完整生成链路配置。
6. 数据库、开发和验证命令。
7. stitch-worker 本地运行和 Cloud Run 部署入口。
8. 常见错误排查。
9. 核心项目文档索引。

### 4.2 前置要求

- Node.js 20.9 或更高版本，推荐 Node.js 22 LTS。
- pnpm 9.15.4，与根目录 `packageManager` 保持一致。
- Neon/Postgres 数据库。
- 只有本地运行 `workers/stitch-worker` 时才要求 ffmpeg。
- 完整生成链路还需要 R2、Google OAuth、Resend、Creem、DeepSeek、视觉模型、APIMart 和 Cloud Run 配置。

### 4.3 快速启动主路径

Windows PowerShell 示例：

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

随后填写 `.env.local`。能够登录并访问工作台的最小配置至少包括应用 URL、`DATABASE_URL`、better-auth secret 和 Google OAuth 凭据。配置完成后执行：

```powershell
pnpm db:migrate
pnpm dev
```

启动后访问：

```text
http://localhost:3000
http://localhost:3000/api/health
```

`/api/health` 返回 `ready=false` 不等于 Next.js 服务没有启动。README 必须解释缺失项对应的不可用模块，并强调未配置真实 Key 时不得返回假成功。

### 4.4 环境变量分层

- 基础启动：`APP_URL`、`APP_ENV`、`DATABASE_URL`、better-auth、Google OAuth。
- 邮件登录：Resend 和发件地址。
- 素材上传：Cloudflare R2。
- 分镜与视频：DeepSeek、视觉模型、APIMart 或 EvoLink 配置。
- 合规与支付：Creem API、webhook 和 Prompt Moderation。
- 异步链路：内部密钥、cron 和 Cloud Run。
- Beta 开关：`VIDEO_DURATION_40_ENABLED`。
- 调试选项：提交重试、任务重生、debug resolution 和 smoke 参数。

`.env.example` 必须补充：

- `APP_ENV=development`
- `ABUSE_HASH_SECRET=`
- `VIDEO_DURATION_40_ENABLED=false`

`PROMPT_MODERATION_MODE=dev_bypass` 只允许个人本地开发。共享环境、staging 和 production 必须使用 Creem Moderation 并 fail closed。

### 4.5 包管理器与 Worktree

- 根项目以 pnpm 为唯一包管理器，删除根目录 `package-lock.json`，保留 `pnpm-lock.yaml`。
- `workers/stitch-worker` 是独立 npm/Docker 构建上下文，保留其 `package-lock.json`。
- `next.config.ts` 必须同时正确识别主仓库根目录和 `.worktree/*`。不能在主仓库运行时把 Turbopack root 错误指向 `D:\`。
- README 只提供 worker 本地快速运行方式，正式部署统一链接到 `docs/deployment/cloud-run-stitch.md`，避免复制两套部署命令。

## 5. 统一视频规格

新增共享的纯配置模块，例如 `src/lib/video/specs.ts`，供服务端、前端和测试共同使用。

建议结构：

```ts
type VideoSpec = {
  durationSeconds: 8 | 16 | 24 | 40;
  segmentCount: 1 | 2 | 3 | 5;
  creditCost: number;
  trialAllowed: boolean;
  releaseStage: "active" | "beta";
  defaultPostQaMode: "lite" | "standard";
};
```

40 秒配置：

```text
durationSeconds = 40
segmentCount = 5
creditCost = 310
trialAllowed = false
releaseStage = beta
defaultPostQaMode = standard
```

`VIDEO_DURATION_40_ENABLED` 是服务端强制开关。关闭时：

- 前端不显示或禁用 40 秒选项。
- Preflight 返回明确不可用原因。
- 创建任务 API 拒绝 40 秒请求。
- 已创建任务仍按数据库状态继续推进，不因关闭开关而中断。

## 6. 40 秒分镜规则

40 秒任务创建 5 个 8 秒镜头槽位，而不是要求 5 个完全不同的模板。

规则：

- 至少使用 3 种不同模板。
- 同一低风险模板最多出现 2 次，但两个片段的镜头指令必须不同。
- 180 度旋转或转身模板最多出现 1 次。
- 相同模板不能连续出现。
- DeepSeek 必须输出 5 个片段，索引为 0-4，每段 `duration_seconds = 8`。
- 三个 Style Preset 均可用于付费 40 秒，但 Preset 不能绕过素材和模板权限。
- 如果可用模板不足以组成合法的 5 段分镜，Preflight 应提示补充素材，而不是放开不可用模板。

示例组合：

```text
1. 正面慢推近
2. 局部裁切展示
3. 15-45 度轻旋转或轻侧身
4. 场景或侧面展示
5. 180 度商品旋转或模特转身
```

## 7. 素材路径与模板规则

### 7.1 素材路径

```text
已有真人模特穿着图
-> 允许 model_front_pose、轻动作、推拉和平移
-> 多角度完整时允许 model_quarter_turn / model_half_turn

只有商品图
-> 允许商品推拉、平移、悬浮、特写
-> 多角度完整时允许 product_quarter_rotation / product_half_rotation
-> 当前阶段禁止隐式生成人体

未来虚拟模特图
-> source = generated_virtual_model
-> 通过一致性检查
-> 复用 model_* 模板
```

### 7.2 新模板

| 模板 ID | 风险 | 必需素材 | 一致性要求 | 试用 | QA |
|---|---|---|---|---|---|
| `product_quarter_rotation` | medium_high | 无人物商品正面 + 侧面 | 同一服装 | 否 | strict |
| `product_half_rotation` | high | 无人物商品正面 + 侧面 + 背面 | 同一服装 | 否 | strict |
| `model_quarter_turn` | medium_high | 模特穿着正面 + 侧面 | 同一服装、同一模特 | 否 | strict |
| `model_half_turn` | high | 模特穿着正面 + 侧面 + 背面 | 同一服装、同一模特 | 否 | strict |

四个模板初始状态均为 `beta`，默认只在“调整镜头”中展示。达到真实成功率和 QA 通过率阈值后，才考虑进入 Preset 自动推荐。

### 7.3 素材能力标签

当前笼统的视角需要结合主体类型扩展为能力标签：

```text
product_front / product_side / product_back
model_front / model_side / model_back
```

逐图分析保留 `front/side/back` 视角，并增加：

```text
subject_kind = product | human_model | unknown
```

模板定义应增加主体和一致性要求，避免把商品与模特逻辑隐藏在 Prompt 字符串中。模板配置继续版本化并保存任务快照。

## 8. 跨图一致性检查

当任务包含两个或以上服装视角，并准备开放旋转或转身模板时，执行任务级多图一致性检查。

结果至少包含：

```text
garment_match: pass | fail | unknown
model_match: pass | fail | not_applicable | unknown
color_match
pattern_match
view_coverage
confidence
risk_flags
```

规则：

- 商品模板要求 `garment_match = pass`。
- 模特模板要求 `garment_match = pass` 且 `model_match = pass`。
- `fail` 和 `unknown` 都禁止高风险模板。
- 检查结果保存快照，供模板推荐、DeepSeek、Post-QA 和后台审计使用。
- 只做当前任务内的视觉一致性判断，不建立人脸特征库或跨任务身份识别系统。

数据流：

```text
逐图素材分析
-> 多图一致性检查
-> 模板资格判断
-> 用户选择模板
-> DeepSeek 只引用允许模板
-> 按正面/侧面/背面顺序生成 signed URL
-> APIMart img_references
-> 生成 8 秒片段
-> Strict QA
```

## 9. Prompt 硬约束

商品旋转：

- 禁止生成真人、手、身体或模特。
- 禁止新增服装结构和不可见细节。
- 15-45 度旋转不得越过已上传侧面素材支持的角度。
- 180 度旋转必须参考正面、侧面和背面素材，禁止继续形成 360 度完整旋转。

模特转身：

- 保持同一模特外观、人体结构和穿着状态。
- 保持服装颜色、图案、领型、袖长、衣长和背面结构。
- 只有正面模特图时允许正面自然姿态和轻微动作，但禁止背面和 180 度转身。
- 正面 + 侧面允许 15-45 度轻侧身。
- 正面 + 侧面 + 背面才允许 180 度转身。
- 禁止把缺失视角通过 Prompt 补齐。

## 10. Post-QA 与抽帧

40 秒任务的抽帧数量必须随片段数扩展，不能沿用当前每个任务固定 3/5/6 帧的实现。

- 40 秒 Standard：每段 4 帧，加 4 个转场帧，共 24 帧。
- 40 秒 Strict：每段 6 帧，加 4 个转场帧，共 34 帧。
- 任何旋转或转身模板使整个 40 秒任务升级为 Strict。
- QA 结果必须记录帧对应的片段索引和时间点。
- 质检应覆盖颜色、图案、版型、正侧背一致性、人体结构、旋转范围和转场异常。

## 11. 失败处理

- 素材不合格或跨图一致性失败：生成前阻止，不冻结点数。
- DeepSeek 未生成 5 段、索引错误或引用非法模板：不冻结点数，允许重新生成分镜。
- 某个视频片段失败：只重试该片段，保留其他成功片段。
- 片段重试耗尽：释放冻结点数，任务进入可审计失败状态。
- 拼接失败：重试 stitch job，不重新生成视频片段。
- QA 能定位到单个片段时：重试该片段，然后重新拼接和质检。
- QA 无法定位或多个片段严重失败：进入人工审核、释放或退款流程。
- 关闭 40 秒 Beta 开关不得破坏已经进入生成链路的任务。

## 12. UI 与后台

用户侧：

- 时长选择显示“40 秒 Beta”。
- 清晰展示 310 点、5 个片段和预计等待时间较长。
- 免费试用选择 40 秒时明确提示只支持付费。
- 进度显示“片段 1/5”到“片段 5/5”。
- 模板不可用时展示缺少的视角、主体类型或一致性失败原因。
- 已有模特图时推荐适用的模特动作；不得因为存在人物就只显示商品模板。

后台：

- 展示 40 秒 Beta 标记、5 个片段、每段模板和重试状态。
- 展示跨图一致性快照。
- 展示 Standard/Strict 抽帧计划和每帧所属片段。
- 分别统计商品旋转和模特转身的成功率、QA 通过率、重试率、成本、下载率和退款率。
- 模板可以通过现有状态机制暂停；40 秒可以通过环境开关暂停新任务。

## 13. 文档同步

实现时同步更新：

- `docs/PRD.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_SPEC.md`
- `docs/STYLE_PRESET_DESIGN.md`
- `.env.example`
- 根目录 `README.md`

现有 PRD 写 12 个模板，但代码已有 13 个模板。新增四个后，文档和代码必须统一记录为 17 个，不能保留旧数字。

## 14. 测试与验收

### 14.1 自动化测试

- 统一视频规格配置、40 秒开关、310 点计费。
- 免费试用请求 40 秒必须拒绝。
- Preflight、任务创建、DeepSeek schema 和确认链路验证 5 段。
- 40 秒镜头槽位的重复限制和高风险模板数量限制。
- 商品/模特素材能力标签和模板资格。
- 多图一致性 `pass/fail/unknown` 的 fail-closed 行为。
- APIMart 多参考图的正面、侧面、背面顺序。
- Cloud Run 5 段拼接、24/34 帧抽取和转场帧。
- UI 的 Beta、310 点、试用禁用和 1/5-5/5 进度。
- 原有 8/16/24 秒行为回归测试。

### 14.2 真实链路验收

- 一条普通 40 秒付费任务。
- 一条包含商品旋转模板的 40 秒 Strict 任务。
- 阶段 C 增加一条包含真人模特转身模板的 Strict 任务。
- 演练单片段失败重试、拼接失败和 QA 定点重试。
- 验证点数 reserve、capture、release/refund 流水。
- 验证 R2 中 5 个片段、最终视频、封面和 QA frames。

### 14.3 工程验证

```powershell
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

真实 Beta 开放前还应运行后端 smoke 和 blocker 验收，并确认生产环境未启用 debug resolution。

## 15. 非目标

- 本设计不实现商品图到虚拟模特图的生成。
- 不允许只有正面图时生成背面、180 度转身或 360 度展示。
- 不允许普通用户绕过跨图一致性检查。
- 不把 40 秒改成供应商一次生成；仍然坚持 8 秒片段化状态机。
- 不把 40 秒开放给免费试用。
- 不在 Vercel Function 中执行 ffmpeg。
- 不让 Style Preset 绕过模板素材和风险规则。
