# CLAUDE.md

本项目默认使用中文沟通。

## 必读文档

请先阅读：

- [docs/PRD.md](docs/PRD.md)
- [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

这是当前产品 PRD 主文档，包含产品定位、MVP 范围、模型策略、镜头模板、任务状态机、计费、对象存储、后台和技术架构。
技术实现、异步任务、模型路由、数据库边界和部署策略以技术架构方案为准。
实施顺序和阶段拆分以实现计划为准。

## 产品摘要

产品是服装商品图生成宣传短视频工具站，服务跨境/独立站中小服装卖家。MVP 采用自助生成流程：上传素材、素材识别、选择模板、确认分镜、生成片段、拼接成片、抽帧质检、下载完整视频。

默认技术与服务：

- Next.js + Vercel
- Neon Postgres
- better-auth
- Tailwind CSS + Radix UI
- cron-job.org
- Cloudflare R2
- Cloud Run stitch-worker + ffmpeg
- Resend
- Creem
- DeepSeek `deepseek-v4-flash`
- 低成本 GPT 视觉模型
- EvoLink `veo3.1-pro-beta`
- APIMart `pixverse-v6` 仅内测
- Creem Moderation 作为 prompt 合规门禁

## Claude Code 协作要求

- 使用中文回答。
- 实现前先核对 PRD 中的业务规则。
- 不要把内部片段结构直接暴露成用户体验。
- 不要把模型自由发挥当成产品规则。
- 涉及生成、扣费、退款、模型调用、管理员操作时，必须考虑审计日志和可复现性。
- 涉及图片/视频生成前的用户 prompt 或最终 prompt 时，必须考虑 Creem Moderation，不能绕过审核。
- UI 方向应偏专业工具站，不做夸张 AI 风格。
