# AGENTS.md

本项目默认使用中文沟通、中文文档和中文需求描述。

## 项目核心文档

请优先阅读并遵守：

- [docs/PRD.md](docs/PRD.md)
- [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- [docs/DEVELOPMENT_SPEC.md](docs/DEVELOPMENT_SPEC.md)

`docs/PRD.md` 是当前产品 PRD 主文档。后续 Codex 进行需求分析、计划、实现、评审时，应以该文档为准。
`docs/TECHNICAL_ARCHITECTURE.md` 是当前技术架构方案，涉及实现边界、异步任务、数据模型、模型路由和部署策略时必须参考。
`docs/IMPLEMENTATION_PLAN.md` 是当前 MVP 实施路线图，编码前应按阶段拆分执行。
`docs/DEVELOPMENT_SPEC.md` 是部署验收前的详细开发 SPEC，具体开发和验收应以它为执行清单。

## 当前产品方向

本项目是面向跨境/独立站中小服装卖家的服装商品图生成宣传短视频工具站。

MVP 核心：

- 用户上传服装素材图。
- 系统识别素材完整度。
- 用户选择镜头模板，系统给出推荐和禁用原因。
- DeepSeek 生成分镜与提示词草稿。
- EvoLink Veo 3.1 Pro Beta 生成 8 秒视频片段。
- 多段片段拼接成 8/16/24 秒完整视频。
- 生成后抽帧质检。
- 免费试用 + 点数包，支付默认 Creem。

## 重要约束

- 不要生成素材中不存在的服装细节。
- 无背面图禁止背面展示、转身、正背切换、360 展示。
- 无细节图禁止生成细节特写。
- DeepSeek 只能引用已启用镜头模板 ID，不能创造新模板。
- 用户侧只看到完整视频任务；后台侧必须能看到每个 8 秒片段。
- Vercel 不执行 ffmpeg 拼接，拼接由 Cloud Run worker 处理。
- 对象存储使用 Cloudflare R2。
- 登录使用 better-auth，支持 Google OAuth 和 Resend Email OTP/Magic Link，MVP 不做密码登录。
- 接入 Creem 后，所有进入图片/视频生成链路的用户 prompt 和最终视频 prompt 必须先过 Creem Moderation；`flag` 和 `deny` 都阻止生成，审核失败时 fail closed。

## 协作要求

- 回答用户时使用中文。
- 对需求保持审视，指出潜在问题和产品风险。
- 不要为了“AI 感”牺牲工具站的清晰、稳定和可控。
- 如果实现前发现 PRD 与用户最新要求冲突，以用户最新要求为准，并同步更新 PRD。
