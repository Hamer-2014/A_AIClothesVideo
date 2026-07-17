# Workspace IA

## User Journey

- Persona / actor: 需要为单个服装 SKU 快速制作宣传视频的跨境电商卖家。
- Scenario / goal: 上传合法素材，选择规格和风格，获得可下载的完整视频。
- Steps / phases: 配置规格 -> 上传素材 -> 服务端预检与分析 -> 自动生成或调整分镜 -> 生成、质检与交付。
- Pain point / insight: 用户关心素材是否足够、需要多少点数和何时可以下载，不应先理解内部模板或供应商概念。

## Task Model

- 唯一主任务 / primary task: 上传当前 SKU 素材并创建完整宣传视频。
- 次目标 / secondary goal: 在生成前确认规格、Style Preset、点数和素材完整度。
- 低频目标 / low-frequency goal: 调整系统推荐的镜头顺序并预览分镜。
- 罕见目标 / rare goal: 处理预检失败、重新分析素材或恢复未完成任务。

## State Model

| 状态 | 进入条件 | 必显信息 | 隐藏信息 | 主 CTA | 离开条件 |
|---|---|---|---|---|---|
| empty | 没有正面素材 | 规格、价格、素材位、缺少正面图 | 模板内部参数、分镜确认 | 上传正面图 | 正面素材可预览 |
| drafting | 已有素材、未创建任务 | 当前规格、授权声明、生成意图 | QA 详情、供应商状态 | 付费生成或 8 秒试用 | Preflight 开始 |
| validating | Preflight、上传或分析运行中 | 当前进度、阻断原因 | 高级槽位编辑 | 等待或修正素材 | 分析通过或阻断 |
| blocked | 规则或合规门禁未通过 | 具体可操作原因 | 无关模板和历史日志 | 补素材或补签 | Preflight 通过 |
| submitted | 分镜已确认并进入生成 | 完整任务进度与下一步 | 单段下载、内部 prompt | 查看任务 | deliverable 或失败 |

## Information Architecture

| 信息项 | 分类 | 使用频率 | 是否首屏必须 | 阶段 | 显示条件 | 建议容器 | 是否可收合 |
|---|---|---:|---|---|---|---|---|
| 规格、比例、点数 | action-critical | 高 | 是 | drafting | 始终 | 左侧控制栏 | 否 |
| 素材位与授权 | action-critical | 高 | 是 | empty/drafting | 始终 | 素材画布 | 否 |
| 当前进度和错误 | status-feedback | 高 | 是 | validating/blocked | 有状态时 | 主 CTA 邻近区域 | 否 |
| 模板可用性 | decision-supporting | 中 | 否 | validating | 分析后 | 延后分析区 | 否 |
| 40 秒五槽位编辑 | decision-supporting | 低 | 否 | validating | 40 秒且分析后 | 模板选择区 | 否 |
| 分镜 JSON 与确认 | on-demand-reference | 低 | 否 | submitted 前 | 展开高级设置 | 高级设置 | 是 |

## Visibility Plan

首屏保留两个主要视觉群组：生成控制和素材画布。主 CTA 与点数、进度和阻断原因保持邻近。模板分析与手动分镜属于下一步信息；40 秒 Beta 只在开关开放时出现在规格分段控件中。

## Content Audit

- must-see-now: 规格、比例、点数、上传状态、授权状态、主 CTA。
- next-step-only: 模板推荐、40 秒五槽位、分镜确认。
- error-only: Preflight 阻断、审核失败、余额不足、供应商异常。
- on-demand-reference: 手动分镜、模板风险说明、内部素材分析摘要。
- keep-off-first-viewport: 供应商 ID、完整 prompt、单个 8 秒片段下载和审计历史。

## Deferred Blocks

| block | hidden_now_because | reveal_trigger | container |
|---|---|---|---|
| 模板分析 | 上传前没有服务端素材事实 | 任务素材分析完成 | `workspace-deferred-analysis` |
| 40 秒槽位编辑 | 只有 40 秒且分析后才有合法模板选项 | 选择 40 秒并完成分析 | 模板分析区 |
| 手动分镜确认 | 一键生成不需要用户先理解分镜 | 用户展开“高级设置”或自动流程保留草稿 | 高级设置区 |
