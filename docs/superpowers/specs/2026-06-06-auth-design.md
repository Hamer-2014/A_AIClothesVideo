# 认证与权限里程碑设计

## 范围

本阶段实现 `DEVELOPMENT_SPEC.md` 第 4 章的基础认证闭环：better-auth、Google OAuth、Resend Email OTP、登录页、服务端 session helper、管理员白名单和角色判断。当前产品不支持 Magic Link 登录。

本阶段不发放免费试用点数，不接 Creem，不创建生成任务。首次登录只确保 `user_profiles` 的创建逻辑有独立 helper，点数发放留到点数账本阶段。

## 架构

认证服务端配置位于 `src/lib/auth/config.ts`，通过 better-auth Drizzle adapter 连接现有 Neon/Drizzle 数据库。API handler 位于 `src/app/api/auth/[...all]/route.ts`。

前端认证客户端位于 `src/lib/auth/client.ts`，登录页位于 `src/app/(auth)/login/page.tsx`。登录页保留 Google 和 Email OTP，不出现 Magic Link 或密码输入。Google、OTP 发送和 OTP 验证共用前端同步锁以阻止快速连点，但不作为安全边界。

邮件发送封装在 `src/lib/auth/email.ts`，统一使用 Resend。缺少 `RESEND_API_KEY` 或 `EMAIL_FROM` 时必须 fail closed，不能返回假成功。

管理员权限由 `src/server/auth/admin-access.ts` 处理。白名单来自 `ADMIN_EMAIL_ALLOWLIST`，支持逗号分隔邮箱；角色来自 `admin_roles` 表。operator 不能执行价格、API Key、模型路由等敏感操作。

## 数据库

better-auth adapter 以官方表结构为准。当前预建表若和 adapter 要求不一致，本阶段通过 schema migration 调整。

`auth_email_events` 表记录 OTP/Email Verification 邮件的 `pending`、`sent` 和 `failed` 状态，包括 provider message id 和错误信息。`magic_link` 事件枚举仅为已有 migration 和历史记录兼容而保留，不代表当前仍支持该登录方式。调用 Resend 前，服务端使用 PostgreSQL advisory transaction lock 按邮箱/IP 串行检查配额并原子写入 `pending` 预占；三种状态全部计入配额，避免并发请求或故意制造发送失败绕过限制。

同一规范化邮箱发送 OTP 时使用 60 秒冷却和每小时 5 次配额；同一 IP 每 10 分钟 10 次配额。better-auth 内置限频显式开启，负责实例内突发保护，数据库预占负责跨 Vercel 实例的最终防滥用边界。

新增 `ADMIN_EMAIL_ALLOWLIST` 到 `.env.example`。

## 测试

本阶段先用 Vitest 覆盖不依赖真实 OAuth 的逻辑：

- admin allowlist 解析大小写、空白和空值。
- admin sensitive action 判断。
- Resend 邮件发送在缺 key/from 时抛错。
- 登录页不包含 password input。
- auth route 导出 GET/POST handler。

Google OAuth 和 Email OTP 的真实发送需要人工验收，因为它依赖 Google callback、Resend 域名和浏览器 cookie。

## 风险

better-auth 版本更新快，adapter/schema 字段要以当前 `1.6.14` 官方包为准。不要硬保留旧表结构。

登录邮件限频依赖数据库 migration 创建 `pending` 枚举值和邮箱/IP 查询索引；未在目标环境应用 migration 前，不能部署依赖该状态的认证配置。真实 Resend 到达、服务端 `429`、共享冷却和数据库事件状态仍需在 staging 完成人工验收。
