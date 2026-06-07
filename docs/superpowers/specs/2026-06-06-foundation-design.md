# 基础工程里程碑设计

## 范围

本阶段只实现 `DEVELOPMENT_SPEC.md` 第 1-2 章：环境变量模板、Next.js 工程骨架、Tailwind、ESLint、TypeScript、健康检查 API 和最小首页。

本阶段不接入 Creem、数据库、R2、认证或模型调用，也不提供任何伪造成功链路。所有外部服务只在 `.env.example` 中声明，后续阶段按真实 key 和 fail-closed 规则接入。

## 架构

主应用采用 Next.js App Router。`src/app` 承载页面和 route handler，`src/components/ui` 存放后续可复用 UI 基础，`src/lib` 和 `src/server` 作为后续业务模块边界。

`GET /api/health` 返回确定性 JSON，用于本地、Vercel 和后续监控探活。首页显示产品名称、MVP 状态和当前不可用的真实集成提示，避免用户误以为生成链路已经可用。

## 前端设计

首页是工具站状态页，不做营销式 AI landing。视觉方向采用安静的 Minimal Premium SaaS：中性色、清晰层级、少量品牌强调色、无夸张渐变和装饰。

首屏只承担一个任务：告诉开发者和早期验收者项目骨架已启动、真实生成链路尚未接入。后续登录后工作台会成为主界面，本阶段不提前堆工作台假 UI。

## 验收

- `npm run lint` 通过。
- `npm run typecheck` 通过。
- `npm run build` 通过。
- `GET /api/health` 在测试中返回 200 和 JSON 状态。
- `.env.example` 覆盖 SPEC 要求的环境变量，不包含真实密钥。
