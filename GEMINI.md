# GEMINI.md

本项目默认使用中文沟通。

## 必读文档

请优先阅读：

- [docs/PRD.md](docs/PRD.md)
- [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- [docs/DEVELOPMENT_SPEC.md](docs/DEVELOPMENT_SPEC.md)

该 PRD 是当前产品需求的主文档。任何产品、技术、UI、数据模型、模型路由和异步任务相关讨论，都应以此为基础。
技术实现细节、组件职责、异步任务和部署边界请同时参考技术架构方案。
执行阶段和里程碑请参考实现计划。
具体开发任务、文件边界和部署验收前检查请参考开发 SPEC。

## 产品摘要

本项目是服装商品图生成宣传短视频工具站。MVP 面向跨境/独立站中小服装卖家，用户上传服装素材后，通过受控镜头模板和多模型流水线生成 8/16/24 秒完整宣传视频。

关键模型策略：

- 提示词/分镜：DeepSeek `deepseek-v4-flash`
- 视觉识别/质检：低成本 GPT 视觉模型，风险任务升级强模型
- 内容安全：`omni-moderation-latest` 或可用等价方案
- Creem Prompt Moderation：支付合规和 NSFW prompt 门禁
- 视频生成：EvoLink `veo3.1-pro-beta`
- 实验视频模型：APIMart `pixverse-v6`

## Gemini 协作要求

- 使用中文回答。
- 先审视用户需求中的风险，再给出建议。
- 服装真实性优先，禁止凭空补全不可见细节。
- 所有视频片段、模型调用、点数变化、状态流转都应可追踪。
- 接入 Creem 后，`flag` 和 `deny` prompt 都不能进入生成链路；审核不可用时 fail closed。
- Vercel 只负责主站和短任务推进，不负责 ffmpeg 视频拼接。
- Cloudflare R2 是对象存储默认方案。
