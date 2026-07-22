# AI Clothes Video UI Guidelines

## Visual Thesis

用石墨黑、纸白与珊瑚红构成安静的服装制作台；真实服装素材和生成成片始终是画面主角。首页采用编辑式大画面，工作台采用紧凑、任务优先的操作界面，禁止用青绿渐变和装饰性卡片制造“AI 感”。

## Usage

- 适用：品牌首页、公开信任页面、登录、三图工作台、任务与账单页面。
- 首页用于证明真实输入和输出，首屏必须出现产品名、真实样片和一个主 CTA。
- 工作台用于完成单个 SKU 的三图任务，主素材画布必须先于设置和参考信息。
- 不适用：营销型卡片瀑布、无真实素材的抽象 AI 插画、把供应商参数展示给普通用户。

## Layout

- 公共页面内容宽度上限为 `max-w-7xl`，移动端水平留白 20px，平板 32px，桌面 48px。
- 首页 hero edge-to-edge；header 与 hero 合计在常见首屏内，并露出下一节入口。
- 工作台桌面使用 `minmax(0, 1fr) + 320-380px inspector`；移动端素材画布在前、设置在后。
- 一个视口最多 2-3 个主要视觉群组。参考和异常信息使用下折、内联状态或首屏后区域。
- Card 只用于单个重复项目或真正有边界的工具。禁止 card 套 card，也不把整页 section 做成悬浮卡片。

## Anatomy

### Brand lockup

1. 珊瑚红方形播放标记。
2. `AI Clothes Video` 产品名。
3. 导航容器；品牌名不能只存在于导航小字。

### Capture protocol selector

1. 协议名称。
2. 推荐或 Beta 状态。
3. 简短素材要求。
4. 三个固定语义槽位，不接受无角色的通用图片列表。

### Upload slot

1. 序号与角色名称。
2. 该视角的具体提示。
3. 稳定预览区域。
4. 上传/重选动作。
5. 上传、成功或失败状态。
6. 仅在有素材时显示删除动作。

### Generation inspector

1. 可选 SKU 名称。
2. 时长与比例。
3. Style Preset。
4. 三图完整度。
5. 可选生成意图。
6. 点数和状态反馈。
7. 唯一主生成 CTA；试用可用时才出现次 CTA。

## States & Spec

| 元件 | Default | Hover / Active | Focus | Disabled / Loading | Error / Empty |
|---|---|---|---|---|---|
| 主按钮 | `--action`、44px 高、`--radius-md` | `--action-hover`，图标可平移 2px | 3px `--focus` outline | 降低透明度，保留稳定尺寸，显示动作状态 | 错误放在按钮邻近区域 |
| 次按钮 | raised surface + `--line` | `--brand-soft` 或 stronger line | 同主按钮 | 不可点击但文本保持可读 | 不用按钮本身承载错误文案 |
| 分段控件 | raised/subtle surface | 选中使用 brand soft + action text | 键盘可见焦点 | 禁用选项解释原因 | 未选择回退推荐协议 |
| 上传槽位 | 3:4 稳定预览，最小点击高 44px | 边线变为 action | 文件输入与操作按钮均可聚焦 | 上传中不能重复提交 | 空态写具体所需视角；失败保留重试 |
| 文本输入 | 40px 高，语义 border/background | border 变强 | focus ring | muted surface | 错误内联，不使用 toast 代替 |
| 状态提示 | 与触发动作同区 | 无装饰 hover | 内部动作可聚焦 | 进度文本 `aria-live` | danger/warning token，不只靠颜色 |

所有交互目标最小 44x44px。卡片圆角不得超过 8px。字体大小使用固定断点，不随 viewport 连续缩放；letter spacing 为 0。

## Interaction

- 首页 hero 文案与真实样片只做一次短进入动画；服装素材 hover 最多放大 1.02。
- 协议切换立即更新三个槽位名称；不同协议不保留角色不兼容的图片。
- 上传过程逐槽反馈，上传中禁用主生成 CTA。失败后允许在原槽位重选。
- 预检失败时保留用户输入，展示可操作中文原因，不跳转到空白错误页。
- 高级设置默认收起；展开与收起使用 150-220ms 的短动画，不做漂浮或循环装饰。
- `prefers-reduced-motion` 下将动画与平滑滚动降为近即时。
- 键盘顺序遵循页面阅读顺序：协议 -> 授权 -> 三槽位 -> inspector -> 主 CTA -> 高级内容。

## Content / Asset

- CTA 使用具体动词：`上传正面图`、`付费生成高清无水印`、`查看任务`；禁止 `确定`、`提交`、`继续` 等脱离上下文的词。
- 错误文案说明缺什么和下一步，例如 `缺少背面图，请在背面槽位上传同一件服装的背面素材`。
- 不承诺“任意三张图”“完整 360”“绝对不失真”或素材中不存在的服装细节。
- 首页只使用真实商品图和真实生成样片。当前 demo 资产位于 `public/demo/`，WebP 单图最长边不超过 1200px，视频使用 H.264 MP4 并启用 faststart。
- 图像必须有描述商品与视角的 alt；纯装饰图标使用 `aria-hidden`，品牌标记提供可访问名称。
- 用户侧只说低/高分辨率与是否带水印，不展示供应商分辨率参数。

## Tokens

语义 token 定义在 `src/app/globals.css`：

- Surface: `--background`、`--surface-raised`、`--surface-subtle`、`--surface-hover`
- Text and line: `--ink`、`--muted`、`--line`、`--line-strong`
- Action and feedback: `--action`、`--action-hover`、`--brand`、`--brand-soft`、`--success`、`--warning`、`--danger`、`--focus`
- Shape and motion: `--radius-xs/sm/md/lg`、`--shadow-sm/md`、`--motion-fast/base/slow`

新增组件必须消费语义 token，不得新增页面专属的青绿渐变、任意大圆角或不可解释的阴影。

## Verification

- 自动：运行 `audit_frontend_principles.py . --require-workbench-ia --require-guideline-docs`。
- 响应式：验证 390x844、768x1024、1440x900。
- 可访问性：键盘遍历、可见 focus、按钮可读名称、状态 `aria-live`、颜色对比。
- 视觉：无横向溢出、无文字覆盖、真实视频首帧非空、三个素材槽位尺寸稳定。
