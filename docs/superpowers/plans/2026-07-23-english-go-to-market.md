# English Go-To-Market and Creem Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先完成 AI Clothes Video 的 Creem 商户审核准备与申请，再建设完整英文转化链路、当前产品关键词页面、未来功能 Waitlist 页面和英文内容集群。

**Architecture:** 采用阶段门控制发布顺序。Creem 审核准备是第一个 Goal，其中包含审核所必需的最小英文生产站、法律页、支持邮箱、Moderation 和真实支付测试；提交审核后可继续英文站建设，但 Creem 未批准、生产支付未验收前不得启动大规模付费获客。SEO 使用 Core / Topic Pillar / Long-tail Support 三层模型，当前功能页面可索引，未实现功能只能保留 noindex Waitlist 或 Content Brief。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, better-auth, Creem Checkout/Webhooks/Moderation, Drizzle/PostgreSQL, Vitest, Google Search Console.

---

## 0. 计划边界与硬顺序

执行顺序不可交换：

1. Creem 审核准备、生产合规检查与申请提交。
2. 完整英文用户转化链路。
3. SEO 技术基础与关键词 URL 分配。
4. 当前真实功能的可索引商业页和案例页。
5. 未来功能的 noindex Waitlist 页面。
6. Topic Pillar 与 Long-tail 内容集群。
7. Creem 批准、生产支付验收后再启动付费投放。

Creem 官方要求产品在申请审核时已经 live。这里的“Creem 排第一”不是拿一个未完成站点立即提交，而是把“最小英文审核包上线并提交审核”作为第一个 Goal。KYC、税务和收款账户资料只提交到 Creem，不得写入仓库、日志或项目文档。

## 1. 当前状态与关键缺口

已有能力：

- Creem checkout client：`src/lib/providers/creem/client.ts`
- Creem webhook 验签：`src/lib/providers/creem/webhook.ts`
- Creem Moderation client：`src/lib/providers/creem/moderation.ts`
- Checkout API：`src/app/api/billing/checkout/route.ts`
- Webhook API：`src/app/api/webhooks/creem/route.ts`
- 点数包：`src/lib/credits/packages.ts`
- 用户 prompt 与最终视频 prompt 已有 fail-closed moderation 调用点。

申请前缺口：

- 网站和完整用户链路仍以中文为主，根页面语言为 `zh-CN`。
- 缺少独立 Acceptable Use Policy 页面。
- 缺少统一、公开、品牌域名支持邮箱配置。
- 点数包中的 Creem Product ID 仍是 `starter`、`creator`、`studio` 占位值。
- Checkout success URL 指向 `/billing/success`，但当前没有对应成功页。
- 尚未完成生产 Creem Product、API Key、Webhook Secret 和 Moderation Key 配置。
- 尚未完成真实 checkout、支付、webhook 幂等入账和 Moderation 人工验收。
- 首页只有一个红色礼服案例，不足以支撑多品类强宣传。
- 没有 robots、sitemap、canonical 和页面级英文 metadata。

## 2. 英文关键词与页面分级

| 层级 | URL | Primary keyword | 当前发布状态 |
|---|---|---|---|
| Brand Hub | `/` | AI Clothes Video | Index，英文品牌首页 |
| Core Product | `/ai-clothing-video-generator` | AI clothing video generator | Index，当前真实功能 |
| Proof | `/examples` | AI clothing video examples | Index，至少 3 个真实 SKU 后发布 |
| Topic Pillar | `/guides/clothing-photo-to-video` | clothing photo to video | Index |
| Topic Pillar | `/solutions/ecommerce-clothing-videos` | ecommerce clothing video | Index |
| Topic Pillar | `/solutions/social-media-clothing-videos` | social media clothing video | Index |
| Long-tail | `/guides/three-photos-to-clothing-video` | three photos to clothing video | Index |
| Long-tail | `/guides/shopify-clothing-product-video` | Shopify clothing product video | Index |
| Long-tail | `/guides/tiktok-fashion-product-video` | TikTok fashion product video | Index |
| Future Core | `/virtual-try-on` | virtual try on | Noindex，功能上线前仅 Waitlist |
| Future Core | `/ai-fashion-model-generator` | AI fashion model generator | Noindex，功能上线前仅 Waitlist |
| Future Core | `/ai-fashion-video-generator` | AI fashion video generator | Noindex，功能边界冻结前不索引 |
| Utility | `/login` | 无 | 永久 Noindex，只负责认证 |

禁止把 `virtual try on`、`AI fashion model generator` 或 `AI fashion video generator` 写进当前工具页并暗示已经交付。`clothing animation jobs`、`clothes design generator` 和 `outfit generator` 进入广告否定词，不建立独立商业页。

---

### Task 1: Creem 审核准备与申请提交

**Files:**
- Modify: `.env.example`
- Modify: `src/app/page.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Create: `src/app/acceptable-use/page.tsx`
- Modify: `src/components/layout/site-footer-content.tsx`
- Modify: `src/components/public/public-pages.test.tsx`
- Modify: `src/app/pricing/page.test.tsx`
- Modify: `src/server/ops/health.ts`
- Modify: `src/server/ops/health.test.ts`
- Modify: `src/lib/credits/packages.ts`
- Modify: `src/lib/credits/packages.test.ts`
- Create: `src/app/(dashboard)/billing/success/page.tsx`
- Create: `src/app/(dashboard)/billing/success/page.test.tsx`
- Review: `src/server/storyboard/generate.ts`
- Review: `src/server/storyboard/confirm.ts`
- Review: `src/lib/providers/creem/moderation.ts`
- Review: `src/app/api/billing/checkout/route.ts`
- Review: `src/app/api/webhooks/creem/route.ts`

- [ ] **Step 1: 核对 Creem 外部资格与审核入口**

打开 Creem 官方 Supported Countries，确认实际税务居住地和收款账户可用。登录 Creem 后进入 `Balance -> Payout Account -> Set up Payout Account`。记录以下非敏感状态到执行日志，不记录证件号、银行账号、API Key 或 KYC 文件：

```text
Creem account created: yes/no
Tax residence supported: yes/no
Payout method available: yes/no
Review package owner: <name or team role>
Review submission status: not_started/submitted/changes_requested/approved
```

Expected: 国家/地区和收款方式可用；不满足时停止生产支付工作，但可以继续 Test Mode。

- [ ] **Step 2: 建立品牌支持邮箱**

创建并验证 `support@aiclothesvideo.com`，保证网站、Creem Business Details 和未来收据使用同一地址。`.env.example` 增加：

```dotenv
SUPPORT_EMAIL=
```

生产环境不得使用 Gmail、QQ Mail 或与域名无关的临时邮箱。

- [ ] **Step 3: 先写 Creem 审核页面失败测试**

在 `src/components/public/public-pages.test.tsx` 和 `src/app/pricing/page.test.tsx` 增加断言：

```tsx
expect(screen.getByRole("link", { name: "Acceptable Use" })).toHaveAttribute(
  "href",
  "/acceptable-use",
);
expect(screen.getByText("support@aiclothesvideo.com")).toBeInTheDocument();
expect(screen.getByText("Starter")).toBeInTheDocument();
expect(screen.getByText("$9.99")).toBeInTheDocument();
```

Run:

```powershell
pnpm exec vitest run "src/components/public/public-pages.test.tsx" "src/app/pricing/page.test.tsx"
```

Expected: FAIL，因为 AUP、统一支持邮箱或英文审核文案尚未完成。

- [ ] **Step 4: 实现最小英文商户审核页面**

审核时必须能从公开网站直接找到：

- 产品是什么：三张服装图片生成 8/16/24 秒商品视频。
- 价格：Starter / Creator / Studio，USD 金额和点数清楚可见。
- 免费与付费区别。
- 失败与退款/释放点数规则。
- Privacy Policy、Terms of Service、Acceptable Use Policy。
- 品牌支持邮箱 `support@aiclothesvideo.com`。
- 真实产品样片和素材边界声明。

Acceptable Use Policy 必须明确禁止：NSFW、色情化或性暗示内容、未授权真人/商标/版权素材、deepfake、face swap、冒充代言、仇恨、暴力和欺诈内容。不得添加假评价、虚构用户数或“guaranteed results”。

- [ ] **Step 5: 将支持邮箱加入生产健康检查**

在 `src/server/ops/health.test.ts` 增加 `SUPPORT_EMAIL` 缺失时 production readiness 失败的测试，再在 `src/server/ops/health.ts` 的生产必需变量中加入 `SUPPORT_EMAIL`。

Run:

```powershell
pnpm exec vitest run "src/server/ops/health.test.ts"
```

Expected: PASS，production 缺品牌支持邮箱时 health fail closed。

- [ ] **Step 6: 将 Creem Product ID 改为生产配置**

`.env.example` 增加：

```dotenv
CREEM_PRODUCT_ID_STARTER=
CREEM_PRODUCT_ID_CREATOR=
CREEM_PRODUCT_ID_STUDIO=
```

`src/lib/credits/packages.ts` 不再把包 code 当生产 Product ID。测试必须证明缺失生产 Product ID 时 checkout 不会向 Creem 发送占位值，并且金额、币种和点数仍由服务端控制。

- [ ] **Step 7: 补齐支付成功页**

创建 `/billing/success`，只展示“Payment received, credits will appear after webhook confirmation.”，不能仅凭返回页面宣称点数已经到账。页面提供 `/billing` 和 `/workspace` 两个后续入口。

Run:

```powershell
pnpm exec vitest run "src/app/(dashboard)/billing/success/page.test.tsx" "src/app/api/billing/checkout/route.test.ts" "src/app/api/webhooks/creem/route.test.ts"
```

Expected: success page 文案与 webhook 真相一致；checkout 和 webhook 测试通过。

- [ ] **Step 8: 复核生产 Moderation 强制闸门**

确认以下两处均在生产环境调用 Creem Moderation，且 `flag`、`deny`、超时、5xx、缺 key 全部阻止后续动作：

```text
User intent -> storyboard generation
Final video prompt -> credit reservation -> provider submission
```

Run:

```powershell
pnpm exec vitest run "src/lib/providers/creem/moderation.test.ts" "src/server/moderation/check-prompt.test.ts" "src/server/storyboard/generate.test.ts" "src/server/storyboard/confirm.test.ts"
```

Expected: 所有测试通过；不存在 production bypass。

- [ ] **Step 9: 部署最小审核包并运行生产前检查**

部署到 `https://aiclothesvideo.com`，人工验证以下 URL 无登录墙、无 404、无中文占位：

```text
/
/pricing
/privacy
/terms
/acceptable-use
/takedown
```

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm exec vitest run --reporter=dot
pnpm build
```

Expected: 全部退出码 0；生产 `/api/health` 的 payments、moderation、auth、email 和 compliance readiness 均通过。

- [ ] **Step 10: Creem Test Mode 真实验收**

在 Creem 创建 Starter、Creator、Studio 三个 one-time payment 产品，将真实 Test Mode Product ID 配置到 staging。完成：

```text
checkout created
hosted checkout opened
test payment completed
checkout.completed webhook received
signature verified
order marked paid
credits added exactly once
duplicate webhook does not add credits again
moderation allow/flag/deny/error verified
```

Expected: 每项都有时间戳和非敏感订单 ID 证据；不得保存卡号或 API Key。

- [ ] **Step 11: 提交 Creem Account Review**

在 `Balance -> Payout Account` 提交：个人/企业名称、产品名、公开产品 URL、业务运营说明、所售产品说明和税务居住国家。建议业务描述：

```text
AI Clothes Video is an independent SaaS product for apparel sellers. Users upload three authorized clothing product images and create short product videos for ecommerce stores and social channels. We sell one-time credit packages in USD. The service uses third-party AI models through our own workflow, applies content moderation before generation, and does not offer face-swap, deepfake, NSFW, or unrestricted generation.
```

Expected: 状态变为 submitted。官方通常在 24-48 小时完成审核，高峰可能到 72 小时；以 Creem 实际通知为准。

- [ ] **Step 12: 提交本阶段代码**

```powershell
git add .env.example src/app src/components/layout/site-footer-content.tsx src/lib/credits src/server/ops
git commit -m "feat: prepare English storefront for Creem review"
```

---

### Task 2: 完整英文转化链路

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/faq/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/login/login-form.tsx`
- Modify: `src/app/(dashboard)/workspace/page.tsx`
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/app/(dashboard)/billing/page.tsx`
- Modify: `src/components/billing/credit-ledger.tsx`
- Modify: `src/lib/auth/email.ts`
- Modify relevant tests beside each file.

Brand homepage Content Brief：

- Target layer: Core / Brand Hub
- Primary keyword: `AI Clothes Video`
- Search intent: Navigation / Product
- Target URL slug: `/`
- Parent page: 无，站点根页面
- Related pages: `/ai-clothing-video-generator`、`/examples`、`/pricing`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 用真实三图输入、真实成片、镜头边界和交付前质检解释品牌，而不是泛 AI 宣传
- Reader stage: Consideration / Decision
- Required examples or assets: 当前红裙真实视频、对应三张原图、至少两个后续授权 SKU 的入口
- Status: Ready after Task 1 review surface

- [ ] **Step 1: 写英文语言契约测试**

根布局断言 `lang="en"`；首页、价格、登录和工作台断言核心英文标题与 CTA；普通用户可见页面不得出现中文操作按钮。管理员后台可继续中文，不纳入此断言。

- [ ] **Step 2: 运行定向测试验证 RED**

```powershell
pnpm exec vitest run "src/app/layout.test.tsx" "src/app/page.test.tsx" "src/app/pricing/page.test.tsx" "src/app/(auth)/login/page.test.tsx" "src/app/(auth)/login/login-form.test.tsx" "src/app/(dashboard)/workspace/page.test.tsx"
```

Expected: FAIL，因为当前用户链路仍有中文文案和 `zh-CN`。

- [ ] **Step 3: 按附录 A 完成英文文案**

登录只保留 Google 和 Email OTP。所有错误、冷却倒计时、授权声明、素材槽位、规格、点数、任务状态和退款文案都使用自然英文，不做中英混排。

- [ ] **Step 4: 验证用户可见页面**

Run 定向测试，然后在 1440x900、390x844 两个视口检查 `/`、`/pricing`、`/login`、`/workspace`，确认无溢出、无中文残留、CTA 可达。

- [ ] **Step 5: 提交英文链路**

```powershell
git add src/app src/components src/lib/auth/email.ts
git commit -m "feat: localize the customer journey for English users"
```

---

### Task 3: SEO 技术基础与 URL 所有权

**Files:**
- Create: `src/lib/seo/site.ts`
- Create: `src/lib/seo/site.test.ts`
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.test.ts`
- Create: `src/app/sitemap.test.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/layout.test.tsx`

- [ ] **Step 1: 写 metadata、robots 和 sitemap 失败测试**

断言：生产 canonical 使用 `https://aiclothesvideo.com`；`/login`、工作台、后台和未来 Waitlist 不索引；sitemap 只包含公开 index 页面；不存在中文 hreflang 伪页面。

- [ ] **Step 2: 建立统一站点配置**

`src/lib/seo/site.ts` 只维护一份：

```ts
export const siteConfig = {
  name: "AI Clothes Video",
  url: "https://aiclothesvideo.com",
  locale: "en_US",
  supportEmail: "support@aiclothesvideo.com",
} as const;
```

- [ ] **Step 3: 实现 SEO 基础**

根 metadata 至少包含 title template、description、metadataBase、canonical、Open Graph 和 Twitter Card。只对当前真实公开页开放索引。首页结构化数据使用 `SoftwareApplication`，价格和功能必须与页面真实内容一致。

- [ ] **Step 4: 验证并提交**

```powershell
pnpm exec vitest run "src/lib/seo/site.test.ts" "src/app/layout.test.tsx" "src/app/robots.test.ts" "src/app/sitemap.test.ts"
pnpm typecheck
git add src/lib/seo src/app/layout.tsx src/app/layout.test.tsx src/app/robots.ts src/app/robots.test.ts src/app/sitemap.ts src/app/sitemap.test.ts
git commit -m "feat: add English SEO foundations"
```

---

### Task 4: 当前产品页与真实案例页

**Files:**
- Create: `src/app/ai-clothing-video-generator/page.tsx`
- Create: `src/app/ai-clothing-video-generator/page.test.tsx`
- Create: `src/app/examples/page.tsx`
- Create: `src/app/examples/page.test.tsx`
- Create: `src/components/public/product-video-example.tsx`
- Create: `src/components/public/product-video-example.test.tsx`
- Modify: `src/components/public/public-header.tsx`
- Modify: `src/components/layout/site-footer-content.tsx`
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: 核对两个 Content Brief**

Product page：

- Target layer: Core Product
- Primary keyword: `AI clothing video generator`
- Search intent: Tool / Product
- Target URL slug: `/ai-clothing-video-generator`
- Parent page: `/`
- Related pages: `/examples`、`/guides/clothing-photo-to-video`、`/pricing`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 三张角色化服装素材、基于素材的镜头限制、交付前质量检查
- Reader stage: Decision
- Required examples or assets: 当前真实红裙案例和至少两个额外授权 SKU
- Status: Ready after Task 2

Examples page：

- Target layer: Core Support
- Primary keyword: `AI clothing video examples`
- Search intent: Decision / Inspiration
- Target URL slug: `/examples`
- Parent page: `/`
- Related pages: `/ai-clothing-video-generator`、`/pricing`、`/guides/three-photos-to-clothing-video`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 同时展示三张原图、协议、规格、成片和限制，不只展示漂亮结果
- Reader stage: Consideration / Decision
- Required examples or assets: 至少 3 个不同品类真实 SKU，每例有宣传授权
- Status: Blocked until assets exist

- [ ] **Step 2: 写页面契约测试**

测试 title/H1/description 唯一；产品页包含真实 CTA、输入要求和限制；案例页少于 3 个真实案例时不加入 sitemap，不能用假卡片占位。

- [ ] **Step 3: 按附录 A 实现当前产品页**

首页只承接品牌词，产品页承接 `AI clothing video generator`。不要同时让两个页面使用相同 title、H1 和正文结构。

- [ ] **Step 4: 获得案例素材后实现 `/examples`**

每个案例必须记录：三张输入图、Capture Protocol、8/16/24 秒规格、真实视频、已知限制、是否有人工后期。没有至少 3 个授权案例时跳过该步骤，不发布空页。

- [ ] **Step 5: 验证并提交**

```powershell
pnpm exec vitest run "src/app/ai-clothing-video-generator/page.test.tsx" "src/app/examples/page.test.tsx" "src/components/public/product-video-example.test.tsx"
pnpm typecheck
git add src/app/ai-clothing-video-generator src/app/examples src/components/public src/app/sitemap.ts
git commit -m "feat: add English product and example pages"
```

---

### Task 5: 未来功能 Waitlist 页面

**Files:**
- Create: `src/app/virtual-try-on/page.tsx`
- Create: `src/app/virtual-try-on/page.test.tsx`
- Create: `src/app/ai-fashion-model-generator/page.tsx`
- Create: `src/app/ai-fashion-model-generator/page.test.tsx`
- Create: `src/app/ai-fashion-video-generator/page.tsx`
- Create: `src/app/ai-fashion-video-generator/page.test.tsx`
- Create: `src/components/public/future-feature-page.tsx`
- Create: `src/components/public/future-feature-page.test.tsx`

- [ ] **Step 1: 冻结发布规则**

三个页面统一要求：`robots.index=false`、不加入 sitemap、不出现在主导航、不显示伪 demo、不链接到当前视频工作台假装功能可用。

对应 Content Brief：

| URL | Target layer | Primary keyword | Search intent | Parent page | Related pages | CTA target | Unique value | Reader stage | Required examples or assets | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `/virtual-try-on` | Core / Future Feature | `virtual try on` | Tool / Product | `/` | Fashion Model Generator、Clothing Video Generator | `mailto:support@aiclothesvideo.com?subject=Virtual%20Try-On%20Early%20Access` | 明确区分试穿预览和商品视频，并提前说明人物与服装授权边界 | Awareness / Consideration | 标注为 concept 的流程图，不使用伪试穿结果 | Draft / Noindex |
| `/ai-fashion-model-generator` | Core / Future Feature | `AI fashion model generator` | Tool / Product | `/` | Virtual Try-On、AI Fashion Video Generator | `mailto:support@aiclothesvideo.com?subject=AI%20Fashion%20Model%20Early%20Access` | 规划生成可继续进入试穿和视频链路的模特素材，而不是孤立图片 | Awareness / Consideration | 标注为 concept 的输入输出说明，不使用伪模特案例 | Draft / Noindex |
| `/ai-fashion-video-generator` | Core / Future Feature | `AI fashion video generator` | Tool / Product | `/` | Clothing Video Generator、Fashion Model Generator | `mailto:support@aiclothesvideo.com?subject=AI%20Fashion%20Video%20Early%20Access` | 解释未来多场景品牌视频与当前 SKU 商品视频的差异 | Awareness / Consideration | 多场景 storyboard 概念图，必须标注功能尚未上线 | Draft / Noindex |

- [ ] **Step 2: 先写 noindex 与真实性测试**

每页断言 `Coming soon` 或 `Early access`、`Join the waitlist`，并且 metadata 为 noindex。页面正文必须解释这是未来功能。

- [ ] **Step 3: 实现共享页面结构**

每页包含：问题定义、计划输入、计划输出、适用用户、与当前 Clothing Video Generator 的区别、隐私/授权提醒和 Waitlist CTA。Waitlist 数据收集是独立 Goal；在该 Goal 完成前，CTA 使用已验证的品牌支持邮箱，不静默丢弃表单。

- [ ] **Step 4: 验证并提交**

```powershell
pnpm exec vitest run "src/app/virtual-try-on/page.test.tsx" "src/app/ai-fashion-model-generator/page.test.tsx" "src/app/ai-fashion-video-generator/page.test.tsx" "src/components/public/future-feature-page.test.tsx"
git add src/app/virtual-try-on src/app/ai-fashion-model-generator src/app/ai-fashion-video-generator src/components/public/future-feature-page*
git commit -m "feat: add noindex future feature previews"
```

---

### Task 6: 英文 Topic Cluster 内容

**Files:**
- Create: `src/app/guides/clothing-photo-to-video/page.tsx`
- Create: `src/app/guides/three-photos-to-clothing-video/page.tsx`
- Create: `src/app/guides/shopify-clothing-product-video/page.tsx`
- Create: `src/app/guides/tiktok-fashion-product-video/page.tsx`
- Create: `src/app/solutions/ecommerce-clothing-videos/page.tsx`
- Create: `src/app/solutions/social-media-clothing-videos/page.tsx`
- Create tests beside each page.
- Modify: `src/app/sitemap.ts`
- Modify: `src/components/layout/site-footer-content.tsx`

- [ ] **Step 1: 按页面角色生成内容，不按关键词批量复制**

| URL | Target layer | Primary keyword | Search intent | Parent page | Related pages | CTA target | Unique value | Reader stage | Required examples or assets | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `/guides/clothing-photo-to-video` | Topic Pillar | `clothing photo to video` | How-to / Tool | `/ai-clothing-video-generator` | 三图指南、电商方案、案例页 | Try the tool | 用真实素材规则解释图片到视频流程和禁用镜头 | Awareness / Consideration | 三种素材角色图、允许/禁止镜头对照 | Ready after Task 4 |
| `/guides/three-photos-to-clothing-video` | Long-tail Support | `three photos to clothing video` | How-to / Tool | `/guides/clothing-photo-to-video` | 案例页、产品页、社媒方案 | Create from 3 photos | 对比商品展示、商品旋转、真人转身三套 Capture Protocol | Consideration | 三套三图协议的真实界面截图 | Ready after Task 4 |
| `/guides/shopify-clothing-product-video` | Long-tail Support | `Shopify clothing product video` | How-to / Product | `/solutions/ecommerce-clothing-videos` | 产品页、案例页、图片转视频指南 | Create a Shopify video | 将视频规格映射到 Shopify 商品页，而非泛平台介绍 | Consideration | 商品页嵌入示意、8/16/24 秒对照 | Draft until Shopify example exists |
| `/guides/tiktok-fashion-product-video` | Long-tail Support | `TikTok fashion product video` | How-to / Inspiration | `/solutions/social-media-clothing-videos` | 产品页、案例页、三图指南 | Create a vertical video | 解释 9:16 素材准备和时长选择，不承诺播放量 | Awareness / Consideration | 9:16 真实成片、封面与安全区示意 | Draft until vertical example exists |
| `/solutions/ecommerce-clothing-videos` | Topic Pillar | `ecommerce clothing video` | Product / Decision | `/` | Shopify 指南、产品页、价格页 | Start free | 解释商品页使用、点数、质检和无法交付处理 | Consideration / Decision | 商品页场景、真实 SKU 成片、价格摘要 | Ready after Task 4 |
| `/solutions/social-media-clothing-videos` | Topic Pillar | `social media clothing video` | Product / Inspiration | `/` | TikTok 指南、产品页、案例页 | Start free | 按社媒画幅和时长组织内容，不虚构平台效果 | Awareness / Consideration | 9:16、1:1、16:9 真实样片 | Draft until channel assets exist |

- [ ] **Step 2: 内容验收规则**

每页必须有独立 title、H1、search intent、向上链接、至少两个横向链接和一个转化 CTA。不得出现虚构统计、自动生成评价、无来源行业数字或与其他页面大段重复的模板正文。

- [ ] **Step 3: 发布与提交**

完成页面测试、内部链接测试和 sitemap 测试后，按 Topic Pillar 一页加 1-2 个 Long-tail 的批次发布，不一次性倾倒全部内容。

---

### Task 7: Creem 批准后的生产支付与推广门禁

**Files:**
- Modify production environment only; do not commit secrets.
- Review: `src/app/api/billing/checkout/route.ts`
- Review: `src/app/api/webhooks/creem/route.ts`
- Review: `src/server/analytics/funnel-events.ts`
- Review: `src/app/api/health/route.ts`

- [ ] **Step 1: 配置生产 Creem 凭据**

配置 production `CREEM_BASE_URL=https://api.creem.io`、API Key、Webhook Secret、Moderation Key 和三个 Product ID。任何值都不得提交到 Git。

- [ ] **Step 2: 生产小额真实支付验收**

使用受控测试账号完成真实 checkout，确认 webhook、订单、点数、重复 webhook、失败处理和用户账单展示。需要退款时通过 Creem 正式流程处理并保留非敏感审计记录。

- [ ] **Step 3: 验证推广漏斗**

```text
landing_viewed
-> trial_cta_clicked
-> login_started
-> three_assets_selected
-> trial_job_created
-> deliverable
-> downloaded
-> checkout_started
-> payment_succeeded
-> paid_generation_started
```

- [ ] **Step 4: 最终上线门禁**

只有以下全部满足才启动 Google Ads 或大规模合作推广：

```text
Creem account approved
production payment verified
production moderation verified
English customer journey complete
3+ authorized SKU examples live
support email monitored
privacy/terms/AUP live
refund and takedown flows tested
full test suite, lint, typecheck, build pass
```

---

## Appendix A: 英文文案参考

### Brand homepage

```text
Eyebrow: Three images. One product video.
H1: AI Clothes Video
Supporting copy: Turn three clothing photos into an 8, 16, or 24-second product video for your store and social channels. Shot selection follows the product details visible in your uploaded images.
Primary CTA: Create a free 8-second video
Secondary CTA: See real examples
Trust line: No invented back views. No fabricated detail close-ups.
```

### Core product page

```text
Title: AI Clothing Video Generator | AI Clothes Video
H1: AI Clothing Video Generator
Description: Turn front, back, and detail photos into a clothing product video with shot selection based on the images you provide.
CTA: Create a free 8-second video
```

### Pricing and payment

```text
Heading: Start with one free video, then pay with credits
Payment note: Credits are reserved before generation and charged only after the video passes quality checks and becomes deliverable.
Failure note: If a task cannot be delivered, reserved credits are released or refunded according to the task status.
```

### Future feature pages

```text
Status: Coming soon
CTA: Join the waitlist
Disclosure: This feature is not yet available. Join the waitlist to receive product updates; the current AI Clothing Video Generator remains available separately.
```

不得使用：

```text
Guaranteed results
Perfect videos every time
Never changes product details
Unlimited or uncensored generation
Up to 3 photos
```

当前产品要求恰好三张图片，使用 `three photos`，不使用 `up to three photos`。

## Appendix B: 官方参考

Creem：

- Account Reviews: https://docs.creem.io/merchant-of-record/account-reviews/account-reviews
- AI Wrapper Compliance: https://docs.creem.io/merchant-of-record/account-reviews/ai-wrapper-compliance
- Supported Countries: https://docs.creem.io/merchant-of-record/supported-countries
- Test Mode: https://docs.creem.io/getting-started/test-mode
- Checkout API: https://docs.creem.io/features/checkout/checkout-api
- Webhooks: https://docs.creem.io/code/webhooks
- Moderation: https://docs.creem.io/features/moderation

SEO 与实现：

- Google SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google Sitemap Guide: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Google Robots Guide: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- Next.js Metadata and OG Images: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
- Schema.org SoftwareApplication: https://schema.org/SoftwareApplication

项目内部参考：

- `docs/PRD.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_SPEC.md`
- `docs/superpowers/specs/2026-06-07-creem-payments-design.md`
- `docs/superpowers/specs/2026-06-07-creem-moderation-design.md`

## Appendix C: 每个阶段的验收命令

开发阶段运行定向测试；每个独立 Goal 完成时运行：

```powershell
pnpm exec vitest run --reporter=dot
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

执行 Creem 外部操作时，验收证据只保留非敏感状态、时间戳和 provider ID；不得把 API Key、Webhook Secret、KYC 文件、证件信息或银行信息写入仓库。
