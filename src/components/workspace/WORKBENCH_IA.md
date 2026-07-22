# AI Clothes Video Workbench IA

## User Flow

- Persona: 需要为单个服装 SKU 快速制作宣传视频的跨境或独立站卖家。
- Scenario: 使用已有商品图创建一条 8/16/24 秒宣传视频。
- Goal: 在不补造服装细节的前提下，完成三图上传、规格确认、生成与下载。
- Sequence: 选择三图协议 -> 确认授权并上传 -> 设置规格与风格 -> 服务端预检 -> 自动分析与生成 -> 查看完整任务。
- Primary surface: 三个有语义的素材槽位组成的素材画布。
- Supporting surface: 只包含会改变本次提交结果的右侧设置 inspector。

## Task Model

| 层级 | 目标 |
|---|---|
| primary goal | 上传当前 SKU 的三张合规素材并创建完整宣传视频。 |
| secondary goal | 在提交前确认协议、Style Preset、时长、比例、生成意图和点数。 |
| low-frequency goal | 查看素材分析、调整推荐镜头或预览分镜。 |
| rare goal | 处理授权失效、预检阻断、重新分析或恢复未完成草稿。 |

## State Model

| 状态 | 进入条件 | 必显信息 | 隐藏信息 | 主 CTA | 离开条件 |
|---|---|---|---|---|---|
| empty | 三个协议槽位均无素材 | 协议、槽位名称、授权声明、输出设置 | 分镜、供应商、QA 详情 | 选择第一张图片 | 任一槽位出现本地预览 |
| uploading | 已选择文件且至少一张正在上传 | 每槽位上传状态、删除/重选能力、禁用的生成按钮 | 模板手调、分镜确认 | 等待上传完成 | 所有进行中的上传完成或失败 |
| validating | Preflight、素材分析或内容审核运行中 | 当前进度、被锁定的主 CTA、邻近状态反馈 | 无关模板与历史日志 | 等待系统检查 | 进入 blocked 或 ready |
| blocked | 缺图、角色不符、授权缺失、审核阻断或余额不足 | 具体原因、受影响槽位、补件或重新确认入口 | 可交付承诺、无关参考内容 | 修正当前阻断 | 再次校验通过 |
| ready | 三槽位上传完成、授权有效、规格可提交 | 3/3 状态、时长与点数、唯一付费生成 CTA；试用可用时显示次 CTA | 内部 prompt、供应商参数、单段任务 | 生成完整视频 | 创建任务并进入 submitted |
| submitted | 任务已创建并进入分析、分镜或生成 | 完整任务进度、用户可理解状态、查看任务入口 | 内部片段下载与审计信号 | 查看任务 | 成片可交付或任务失败 |

## Information Roles

| 信息项 | 角色 | 原因 |
|---|---|---|
| 协议选择、素材槽位、授权 | action-critical | 决定是否能合法创建任务。 |
| 时长、比例、Style Preset、生成意图 | decision-supporting | 直接改变本次输出与点数。 |
| 上传、预检、审核、生成状态 | status-feedback | 解释系统正在做什么以及为何不可提交。 |
| 三图规则、模板风险说明 | reference | 需要时可查，不应挤占主画布。 |
| 补图、重签、重试 | exception-handling | 只在对应失败状态出现。 |
| 任务事件、供应商 ID、完整 prompt | audit/history | 仅后台或任务详情使用。 |

## Information Architecture

| 信息项 | 频率 | 首屏必须 | 阶段 | 显示条件 | 容器 | 可收合 |
|---|---:|---|---|---|---|---|
| 三图协议与槽位 | 高 | 是 | empty/ready | 始终 | 主素材画布 | 否 |
| 上传授权 | 高 | 是 | empty/uploading | 始终 | 槽位上方内联 | 否 |
| SKU、规格、Style Preset | 高 | 是 | empty/ready | 始终 | 右侧 inspector | 否 |
| 点数与主 CTA | 高 | 是 | ready | 始终邻近 | inspector 底部 | 否 |
| 上传/阻断状态 | 中高 | 状态发生时是 | uploading/blocked | 有状态时 | 主 CTA 邻近提示 | 否 |
| 素材分析与模板 | 中低 | 否 | validating/submitted | 素材可预览后 | 首屏之后的分析区 | 否 |
| 40 秒五槽位编辑 | 低 | 否 | submitted 前 | 开关开启且选择 40 秒 | 模板分析区 | 否 |
| 手动分镜 | 低 | 否 | submitted 前 | 用户主动展开或自动流程保留草稿 | 高级 disclosure | 是 |
| 供应商与审计详情 | 低 | 否 | submitted | 管理员排障 | 后台任务详情 | 是 |

## Content Audit

- must-see-now: 协议、三张素材、授权、规格、点数、上传状态、主 CTA。
- next-step-only: 素材分析、推荐模板、40 秒镜头顺序、分镜草稿。
- error-only: 上传失败、Preflight 阻断、审核失败、余额不足、供应商异常。
- on-demand-reference: 模板风险说明、手动分镜、素材分析摘要。
- keep-off-first-viewport: 供应商 ID、完整 prompt、单个 8 秒片段下载、审计历史。

## Visibility Plan

首屏最多保留两个主要视觉群组：左侧三图素材画布与右侧提交 inspector。移动端保持同一阅读顺序，素材在前、设置在后。状态反馈必须紧邻对应槽位或主 CTA；分析和手动分镜位于首屏之后，不与三图上传竞争注意力。

```json
[
  {"id":"material_canvas","role":"action-critical","priority":"high","visibility":"always","stage":["empty","uploading","ready"],"container":"main-stage"},
  {"id":"generation_inspector","role":"decision-supporting","priority":"high","visibility":"always","stage":["empty","ready"],"container":"right-rail"},
  {"id":"control_status","role":"status-feedback","priority":"high","visibility":"conditional","stage":["uploading","validating","blocked"],"container":"cta-adjacent"},
  {"id":"analysis","role":"reference","priority":"medium","visibility":"below-fold","stage":["validating","submitted"],"container":"analysis-section"},
  {"id":"manual_storyboard","role":"reference","priority":"low","visibility":"on-demand","stage":["ready"],"container":"disclosure"}
]
```

## Deferred Blocks

| block | hidden_now_because | reveal_trigger | container |
|---|---|---|---|
| 素材分析与模板 | 上传前缺少服务端素材事实，而且普通用户可以直接采用推荐 | 用户滚动到首屏之后；任务创建后填充真实分析 | `workspace-deferred-analysis` |
| 40 秒镜头顺序 | 仅 40 秒 Beta 需要五个镜头槽位 | 打开功能开关、选择 40 秒并完成分析 | 模板分析区 |
| 手动分镜确认 | 一键生成不要求用户先理解分镜结构 | 展开“高级设置”或自动流程保留分镜草稿 | 高级 disclosure |
| 失败重试 | 正常路径不需要重试控件 | 对应上传、分析或生成步骤失败 | 原步骤内联错误区 |
