# 认证与权限里程碑设计

## 范围

本阶段实现 `DEVELOPMENT_SPEC.md` 第 4 章的基础认证闭环：better-auth、Google OAuth、Resend Email OTP、Magic Link、登录页、服务端 session helper、管理员白名单和角色判断。

本阶段不发放免费试用点数，不接 Creem，不创建生成任务。首次登录只确保 `user_profiles` 的创建逻辑有独立 helper，点数发放留到点数账本阶段。

## 架构

认证服务端配置位于 `src/lib/auth/config.ts`，通过 better-auth Drizzle adapter 连接现有 Neon/Drizzle 数据库。API handler 位于 `src/app/api/auth/[...all]/route.ts`。

前端认证客户端位于 `src/lib/auth/client.ts`，登录页位于 `src/app/(auth)/login/page.tsx`。登录页只提供 Google、Email OTP 和 Magic Link，不出现密码输入。

邮件发送封装在 `src/lib/auth/email.ts`，统一使用 Resend。缺少 `RESEND_API_KEY` 或 `EMAIL_FROM` 时必须 fail closed，不能返回假成功。

管理员权限由 `src/server/auth/admin-access.ts` 处理。白名单来自 `ADMIN_EMAIL_ALLOWLIST`，支持逗号分隔邮箱；角色来自 `admin_roles` 表。operator 不能执行价格、API Key、模型路由等敏感操作。

## 数据库

better-auth adapter 以官方表结构为准。当前预建表若和 adapter 要求不一致，本阶段通过 schema migration 调整。

新增 `auth_email_events` 表，记录 OTP/Magic Link/Email Verification 邮件发送成功与失败，包括 provider message id 和错误信息。这样 SPEC 中“登录邮件发送记录保存成功/失败和 provider message ID”有明确落点。

新增 `ADMIN_EMAIL_ALLOWLIST` 到 `.env.example`。

## 测试

本阶段先用 Vitest 覆盖不依赖真实 OAuth 的逻辑：

- admin allowlist 解析大小写、空白和空值。
- admin sensitive action 判断。
- Resend 邮件发送在缺 key/from 时抛错。
- 登录页不包含 password input。
- auth route 导出 GET/POST handler。

Google OAuth、Email OTP 和 Magic Link 的真实发送需要人工验收，因为它依赖 Google callback、Resend 域名和浏览器 cookie。

## 风险

better-auth 版本更新快，adapter/schema 字段要以当前 `1.6.14` 官方包为准。不要硬保留旧表结构。

登录邮件限频本阶段只预留 `auth_email_events` 和发送记录；完整 IP/邮箱限频放到滥用控制阶段实现，否则范围会扩成风控系统。
