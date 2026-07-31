# 虚拟试穿创建工作台 UI Guideline

## 使用场景

- **Persona / scenario / primary task：** 跨境服装卖家在已有商品素材后，选择可交付的定妆模式、上传并授权所需图片，然后提交一份 AI 模特静态试穿任务。
- **用户流程：** 选模式 -> 上传/授权 -> 提交 -> 等待 -> 锁定/下载。
- 本页面不是商品视频工作台的子步骤，也不是说明型落地页；它的主舞台只服务于创建一份静态 appearance pack。

## Usage

仅在已登录 DashboardShell 中使用 `VirtualTryOnCreateForm`。创建页不承担任务详情、锁定、下载、视频生成或后台审计职责。

## 任务模型

| 层级 | 任务 | 信息角色 | 首屏 |
| --- | --- | --- | --- |
| Primary | 选择 `front_only` 或 `three_view`，完成当前模式要求的服装素材并提交 | action-critical | 是 |
| Secondary | 确认商业使用权、填写可选 SKU、理解当前缺项 | action-critical / status-feedback | 是，仅就近显示 |
| Low-frequency | 查看服务条款、隐私条款和模式要求 | reference | 否，使用 UploadPanel 的现有链接与短提示 |
| Rare | 余额不足、审核拒绝、临时服务故障后的恢复 | exception-handling | 否，仅在错误时显示 |

## 状态模型

| 状态 | 进入条件 | Must-show | Hidden | 唯一 CTA | Exit |
| --- | --- | --- | --- | --- | --- |
| `empty` | 首次打开，没有上传素材 | 模式选择、当前必需槽位、授权勾选、禁用提交及最短缺项 | 错误、上传进度、重试文案 | 无可用 CTA | 选择模式或素材 |
| `drafting` | 已选择模式或至少一张素材 | 当前模式、素材槽位、授权、SKU | 其他模式的槽位、历史/计费说明 | 提交定妆图（未就绪时禁用） | 所有必需素材已上传且授权 |
| `uploading` | 任一 UploadPanel 槽位上传中 | 对应槽位上传状态、禁用 CTA、最短等待文案 | 提交错误、重试网络细节 | 正在上传（禁用） | 上传完成或失败 |
| `submitting` | POST 创建请求进行中 | 提交中的主按钮、保留素材与模式 | 模式切换、删除素材、内部错误详情 | 正在提交（禁用） | 成功跳转或可恢复错误 |
| `blocked` | 上传失败、素材/授权缺失、402、409 或 503 | 就近中文/英文安全错误、对应补件或重试入口 | 内部错误码、R2 key、供应商信息 | 补齐素材或重试提交 | 用户修复或重试成功 |
| `submitted` | API 返回 jobId/packId | 短暂提交成功反馈 | 创建表单的交互 CTA | 正在打开任务 | router push 到详情页 |

## Information Architecture / 信息架构表

| 信息项 | 频率 | 首屏必须 | 阶段 | 条件 | 容器 | 可收合 | 角色 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 模式切换 | 高 | 是 | empty/drafting | 始终 | 主工作区顶部 segmented control | 否 | action-critical |
| 当前模式素材槽位 | 高 | 是 | empty/drafting/uploading | 始终 | UploadPanel 主工作区 | 否 | action-critical |
| 授权声明 | 高 | 是 | empty/drafting | 始终 | UploadPanel 内联 | 否 | action-critical |
| SKU | 中低 | 是 | drafting | 始终 | 素材区下方紧凑 input | 否 | decision-supporting |
| 缺项/上传状态 | 中高 | 是 | empty/uploading/blocked | 按状态 | CTA 邻近文本 | 否 | status-feedback |
| 创建错误 | 低 | 否 | blocked | 请求或上传失败 | CTA 邻近 `role=alert` | 否 | exception-handling |
| 规则、条款 | 低 | 否 | any | 用户主动查看 | UploadPanel 现有链接 | 是 | reference |
| 任务历史、QA、下载、视频桥接 | 低 | 否 | submitted 之后 | 详情页 | 详情页 | 否 | audit/history |

## 内容审计

| 分类 | 内容 |
| --- | --- |
| `must-see-now` | 模式、必需素材槽位、授权、SKU、单一提交 CTA |
| `next-step-only` | 排队/QA/锁定/下载状态与视频桥接 |
| `error-only` | 上传失败、余额不足、审核阻断、临时不可用与重试 |
| `on-demand-reference` | 商业使用授权完整文字、条款、隐私政策 |
| `keep-off-first-viewport` | provider 原始响应、R2 key、API key、任务审计、视频能力细节 |

## Deferred Blocks

| block | hidden_now_because | reveal_trigger | container |
| --- | --- | --- | --- |
| 任务状态、QA 与下载 | 创建前没有可展示的 pack | API 创建成功后进入详情页 | 详情页主内容 |
| 视频桥接 | 本 Goal 不执行视频生成，创建阶段不能承诺成功 | ready/locked detail 返回 bridge | 详情页次级能力区 |
| 服务条款与隐私完整内容 | 不帮助完成当前素材选择 | 用户点击 UploadPanel 内链接 | 独立页面 |
| 错误恢复文案 | 正常流程下会干扰主任务 | 上传或创建出现安全错误 | CTA 邻近 alert |
| 计费/审核的内部原因 | 对用户不能执行补救且可能泄露内部实现 | 永不在创建页展示 | 后台审计 |

## 组件与视觉规范

- 复用 `src/app/globals.css` 的 `--surface`、`--surface-raised`、`--ink`、`--muted`、`--line`、`--action`、`--focus`、现有 radius 与 motion tokens；禁止新造色板、渐变和大圆角。
- `VirtualTryOnCreateForm` anatomy：页面标题下的单一主工作区、模式 segmented control、UploadPanel、SKU input、CTA 邻近状态/错误。不要增加概要卡、侧栏或独立说明卡。
- Segmented control 必须使用 button group、`aria-pressed`、可见 focus ring、默认/hover/active/focus/disabled 状态；模式切换清理不适用于新模式的素材。
- UploadPanel 使用自定义 slots：`front_only` 仅 `front`；`three_view` 按 `front`、`back`、`detail`。不得出现 `side` 上传槽位。
- CTA 仅一枚：全部必需上传素材处于 `uploaded`、无上传进行中且授权已勾选时可用；loading 时保持尺寸并禁用。
- 文案由 `workspaceText(SiteLocale, English, Chinese)` 产生；展示的错误只能是映射后的安全用户文案，不能透出 server error、URL 或 key。
- Desktop 保持主工作区最大宽度与 3 槽并列；tablet 允许 3 槽缩放；mobile 改为单列，模式控件可换行，CTA 全宽，长文件名截断，触控目标不小于现有 36px 控件。
- 使用语义化 `form`、`label`、`fieldset`/`legend`、`aria-live` 与 `role=alert`；键盘可操作全部交互；沿用全局 `:focus-visible`。

## Layout

创建页由 DashboardShell 的页面引言和一个无嵌套卡片的表单工作区组成。Desktop 使用现有 `max-w-7xl` 页面容器，UploadPanel 在三视图模式内承担三槽位网格；mobile 收为单列，提交按钮全宽。

## Anatomy

`VirtualTryOnCreateForm` 的构成固定为 mode segmented control、UploadPanel、可选 SKU、状态/错误行和一个 primary CTA。UploadPanel 的 rights checkbox 保持在素材工作区内，不能移动为独立确认卡。

## States & Spec

组件实现 `empty`、`drafting`、`uploading`、`submitting`、`blocked` 与 `submitted`；完整进入条件、必显信息、隐藏信息、CTA 和 exit 见上方状态模型。所有 async 状态保留控件高度并禁用会改变 payload 的交互。

## Interaction

模式按钮用 `aria-pressed`，可通过键盘聚焦和点击操作。模式或素材 payload 变化会生成新的 Idempotency-Key；503 重试保留 key，402 后清理 key 并在下一次提交生成新 key。错误使用 CTA 邻近 alert，不展示内部服务详情。

## Content / Asset

所有文案经 `workspaceText` 按 `SiteLocale` 输出。素材只接受 UploadPanel 支持的 PNG/JPEG/WebP；上传携带 `image_rights_v1`，页面不显示 R2 key、签名 URL、provider raw response 或 API key。

## 可验证的页面结构

```text
DashboardShell
  Page intro
  VirtualTryOnCreateForm (唯一主工作区)
    mode segmented control
    UploadPanel (当前模式槽位 + rights)
    optional SKU
    status/error + one primary CTA
```
