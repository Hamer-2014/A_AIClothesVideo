# AI Clothes Video 上线宣传与 SEO 方案

> **状态：已被取代。** 本文基于“中文市场优先”的旧假设保留作历史参考。当前英文市场上线、Creem 审核和关键词页面执行顺序以 [英文市场上线实施计划](superpowers/plans/2026-07-23-english-go-to-market.md) 为准。

版本：首发规划
日期：2026-07-23
目标市场：第一阶段面向中文跨境/独立站服装卖家；英文站在产品完成英文界面后单独建设。

## 1. 宣传口径决策

### 1.1 品牌与核心定位

- 品牌名：`AI Clothes Video`
- 推荐主张：`只需 3 张服装图，生成可发布的商品宣传视频。`
- 英文辅助语：`Three images. One product video.`
- 核心受众：已有商品图、缺少短视频素材的跨境服装卖家。
- 核心场景：Shopify 商品页、TikTok、Instagram Reels、YouTube Shorts。

### 1.2 禁止直接使用的承诺

不要公开使用“保证效果”“绝对不变形”“任意三张图都能生成”“100% 可发布”等承诺。

原因：

- 生成质量受素材清晰度、视角完整度、模型排队与质检重试影响。
- PRD 明确要求不能生成素材中不存在的背面或服装细节，也不能承诺 100% 无异常。
- “保证效果”没有可量化的验收标准，会引发广告合规、拒付和退款争议。

可替代的可信表达：

- `专为服装商品图设计的 AI 视频生成器。`
- `生成前检查素材，生成后进行抽帧质检。`
- `无背面图不生成背面，无细节图不生成细节特写。`
- `无法交付时释放或退回点数。`
- `演示样片来自真实测试素材，实际结果取决于上传素材与所选规格。`

### 1.3 “最多 3 张”与当前产品的冲突

当前工作台的三种 Capture Protocol 都要求恰好 3 张图，服务端在不足三张时拒绝创建任务。因此上线阶段使用“只需 3 张”，不使用“最多 3 张”。

如未来要使用“最多 3 张”，必须先把产品改为允许 1-3 张输入，并明确单图、双图和三图各自允许的镜头与质量边界。

## 2. 现有公开页面盘点

| 页面 | URL | 当前搜索意图 | 层级 | 父页面 | 主要 CTA | 处理建议 |
|---|---|---|---|---|---|---|
| 品牌首页 | `/` | 产品 / Tool | Core | 无 | `/workspace?mode=trial&preset=minimal_studio` | 作为唯一核心商业页，承接主关键词 |
| 价格 | `/pricing` | Decision | Core Support | `/` | 免费试用 / 工作台 | 增加页面级 metadata 与 FAQ 内链 |
| FAQ | `/faq` | Problem-solving | Core Support | `/` | 免费试用 | 改为可扫描问答并链接主题页 |
| 登录 | `/login` | Navigation | Utility | `/` | 登录 | noindex，不承担 SEO |
| 工作台 | `/workspace` | Tool | Conversion | `/` | 创建任务 | 登录态工具页，不承担内容排名 |
| 隐私/条款/侵权 | `/privacy`、`/terms`、`/takedown` | Legal | Utility | 页脚 | 法务动作 | 保留可发现性，不作为关键词页 |

当前缺口：

- 没有 `sitemap.xml` 和 `robots.txt`。
- 没有真实案例集合页。
- 没有 Topic Pillar 和 Long-tail Support 页面。
- 首页只有一个红色礼服示例，不足以支撑“稳定适用于不同服装品类”的强宣传。
- 全站为中文界面和 `zh-CN`，暂时不应直接发布英文 SEO 页面造成语言与转化体验断裂。

## 3. 站点内容架构

```text
/                                      Core：AI 服装视频生成器
├── /examples                          Core Support：真实输入与成片案例
├── /pricing                           Core Support：价格与点数
├── /faq                               Core Support：生成边界与常见问题
├── /solutions/ecommerce-clothing-video
│   ├── /guides/shopify-clothing-product-video
│   └── /guides/clothing-video-for-product-pages
├── /solutions/social-media-clothing-video
│   ├── /guides/tiktok-clothing-video
│   └── /guides/instagram-reels-clothing-video
└── /guides/clothing-photo-to-video
    ├── /guides/three-images-to-clothing-video
    ├── /guides/clothing-video-without-back-image
    └── /compare/ai-clothing-video-vs-product-shoot
```

广告专用页面：

- `/lp/three-images-clothing-video`
- 使用 `noindex, nofollow`，不加入 sitemap。
- 只服务付费广告和合作渠道，避免与首页争夺同一商业关键词。
- 页面仅保留一个核心行动：开始免费试用。

## 4. 首批 Content Brief

### 4.1 品牌首页

- Target layer: Core / Conversion Hub
- Primary keyword: AI 服装视频生成器
- Search intent: Tool / Product
- Target URL slug: `/`
- Parent page: 无，站点根页面
- Related pages: `/examples`、`/pricing`、`/guides/clothing-photo-to-video`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 恰好三张服装素材协议、素材边界约束、生成后抽帧质检、真实三图到成片演示
- Reader stage: Decision
- Required examples or assets: 至少 3 个不同服装 SKU 的三图输入与成片；首屏保留真实视频
- Status: Ready for copy refinement

### 4.2 真实案例页

- Target layer: Core Support
- Primary keyword: AI 服装视频案例
- Search intent: Decision / Inspiration
- Target URL slug: `/examples`
- Parent page: `/`
- Related pages: `/pricing`、`/guides/three-images-to-clothing-video`、`/faq`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 同时展示原始三张图、所选协议、时长、成片和已知限制，不只展示剪辑后的漂亮结果
- Reader stage: Consideration / Decision
- Required examples or assets: 连衣裙、上衣、外套、裤装至少各 1 个真实案例；每例必须获宣传授权
- Status: Draft，素材不足时不得发布空案例页

### 4.3 电商服装视频方案页

- Target layer: Topic Pillar
- Primary keyword: 电商服装视频制作
- Search intent: Product / Decision
- Target URL slug: `/solutions/ecommerce-clothing-video`
- Parent page: `/`
- Related pages: `/solutions/social-media-clothing-video`、`/guides/shopify-clothing-product-video`、`/guides/clothing-photo-to-video`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 按商品页场景解释 8/16/24 秒规格、素材协议、无水印付费交付和无法交付的点数处理
- Reader stage: Consideration
- Required examples or assets: 商品页嵌入示意、三种时长对比、真实成片
- Status: Ready

### 4.4 社媒服装短视频方案页

- Target layer: Topic Pillar
- Primary keyword: 服装短视频生成
- Search intent: Product / Inspiration
- Target URL slug: `/solutions/social-media-clothing-video`
- Parent page: `/`
- Related pages: `/solutions/ecommerce-clothing-video`、`/guides/tiktok-clothing-video`、`/guides/instagram-reels-clothing-video`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 把同一 SKU 的三图输入映射到 9:16、1:1、16:9 与 8/16/24 秒使用建议，不虚构平台发布效果
- Reader stage: Awareness / Consideration
- Required examples or assets: 9:16 样片、封面图、不同平台的画幅示意
- Status: Ready

### 4.5 服装图片转视频指南

- Target layer: Topic Pillar
- Primary keyword: 服装图片生成视频
- Search intent: How-to
- Target URL slug: `/guides/clothing-photo-to-video`
- Parent page: `/`
- Related pages: `/guides/three-images-to-clothing-video`、`/guides/clothing-video-without-back-image`、`/solutions/ecommerce-clothing-video`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 用真实工作台规则说明素材角色、镜头权限和常见失败，而不是泛泛介绍 AI 视频工具
- Reader stage: Awareness / Consideration
- Required examples or assets: 正面/背面/细节图标注、可用与禁用镜头示例
- Status: Ready

### 4.6 三张图生成服装视频

- Target layer: Long-tail Support
- Primary keyword: 三张服装图生成视频
- Search intent: How-to / Tool
- Target URL slug: `/guides/three-images-to-clothing-video`
- Parent page: `/guides/clothing-photo-to-video`
- Related pages: `/examples`、`/guides/clothing-video-without-back-image`、`/solutions/social-media-clothing-video`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 对比商品展示、商品旋转、真人转身三套三图协议，并明确各协议的素材一致性要求
- Reader stage: Consideration
- Required examples or assets: 三套协议各自的三图槽位示意
- Status: Ready

### 4.7 缺少背面图时能否生成

- Target layer: Long-tail Support
- Primary keyword: 没有背面图可以生成服装视频吗
- Search intent: Problem-solving
- Target URL slug: `/guides/clothing-video-without-back-image`
- Parent page: `/guides/clothing-photo-to-video`
- Related pages: `/faq`、`/guides/three-images-to-clothing-video`、`/examples`
- CTA target: `/workspace?mode=trial&preset=minimal_studio`
- Unique value: 直接解释不能编造背面、可替代的正面推拉和平移镜头，以及如何补拍合格素材
- Reader stage: Awareness / Consideration
- Required examples or assets: 允许/禁止镜头对照图
- Status: Ready，但当前恰好三图协议上线后应解释可替换素材而非宣称少于三图可提交

## 5. 关键词设计

关键词分组按搜索意图设计，不虚构搜索量。上线后使用 Search Console、广告搜索词报告和站内转化数据重新排序。

### 5.1 核心商业词

| 关键词 | 页面 | 意图 | 优先级 |
|---|---|---|---|
| AI 服装视频生成器 | `/` | Tool | P0 |
| 服装图片生成视频 | `/guides/clothing-photo-to-video` | How-to / Tool | P0 |
| 商品图生成视频 | `/`，正文使用变体 | Tool | P0 |
| AI 商品视频生成器 | `/solutions/ecommerce-clothing-video` | Product | P1 |
| 服装宣传视频制作 | `/solutions/ecommerce-clothing-video` | Decision | P1 |
| 服装短视频生成 | `/solutions/social-media-clothing-video` | Product | P1 |

### 5.2 产品差异化词

- 三张服装图生成视频
- 3 张图片生成服装视频
- 服装正面背面细节图生成视频
- 无模特服装图生成视频
- AI 服装视频质量检查
- 如何减少 AI 服装视频细节漂移

不要使用“AI 服装视频绝对不变形”作为关键词或标题承诺。

### 5.3 场景词

- Shopify 服装产品视频
- TikTok 服装视频制作
- Instagram Reels 服装视频
- 独立站商品页服装视频
- 跨境电商服装短视频
- 服装 SKU 宣传视频

### 5.4 问题与长尾词

- 服装商品图怎么做成视频
- 没有背面图可以生成服装视频吗
- 服装细节图如何生成宣传视频
- AI 服装视频为什么会变形
- 服装视频生成需要几张图片
- 真人模特图片如何生成转身视频
- AI 服装视频和传统商品拍摄哪个好

### 5.5 英文词库（第二阶段）

英文页面必须等英文 UI、英文条款和英文客服口径可用后再发布：

- AI clothes video generator
- clothing photo to video AI
- fashion product video generator
- apparel video generator
- product images to video
- Shopify clothing product video
- TikTok fashion product video
- three images to clothing video

## 6. 首页着陆页信息架构

### 首屏

- Eyebrow: `Three images. One product video.`
- H1: `AI Clothes Video`
- Supporting copy: `只需 3 张服装图，生成可发布的商品宣传视频。系统按真实素材约束镜头，并在交付前完成质量检查。`
- Primary CTA: `免费生成 1 条 8 秒试用视频`
- Secondary CTA: `查看真实案例`
- Trust line: `无背面图不生成背面，无细节图不生成细节特写。`

### 后续区块顺序

1. 真实三图与成片对照，先给证据。
2. 三种三图协议，解释为什么不是任意三张。
3. 三步生成流程，降低理解成本。
4. 商品页、TikTok/Reels 两类场景入口。
5. 素材边界与生成后质检，建立可信度。
6. 价格摘要与失败点数处理。
7. 常见问题。
8. 单一主 CTA 收尾。

首页不应增加大段泛 AI 原理、供应商模型名称或“行业革命”式文案。

## 7. 广告宣传页设计

`/lp/three-images-clothing-video` 用于 Google Ads、社群投放和创作者合作链接：

- 页面设为 noindex，避免与首页关键词互相竞争。
- 去掉常规导航，只保留品牌、真实演示、输入要求、价格信号和 CTA。
- 首屏直接播放真实成片，旁边或下方展示三张原图。
- 全页只使用一个主要 CTA：`免费生成 1 条试用视频`。
- URL 添加 `utm_source`、`utm_medium`、`utm_campaign`，并写入现有 funnel event metadata。
- 不为不同广告词复制大量近似页面；先通过 query/UTM 切换少量标题文案。

推荐广告主文案：

- 标题：`3 张服装图，生成一条商品视频`
- 正文：`上传正面、背面和细节图，AI Clothes Video 按素材边界生成 8/16/24 秒宣传视频。新用户可免费试 1 条 8 秒视频。`
- 证据：`真实三图输入 · 镜头权限检查 · 交付前质量检查`

## 8. 内链与锚文本

| 来源 | 目标 | 推荐锚文本变体 |
|---|---|---|
| 首页 | `/examples` | 查看真实三图生成案例 / 对比原图和成片 |
| 首页 | `/guides/clothing-photo-to-video` | 了解服装图片如何生成视频 |
| 指南页 | 首页 | 在线试用 AI 服装视频生成器 / 用三张图开始制作 |
| 电商方案页 | 社媒方案页 | 同一 SKU 的社媒短视频做法 |
| 三图指南 | 无背面图指南 | 缺少背面图时先看镜头限制 |
| 所有商业页 | `/pricing` | 查看视频规格与点数 / 了解免费试用和付费交付 |

避免所有文章都用完全一致的“AI 服装视频生成器”锚文本指向首页。

## 9. 上线节奏

### Phase 0：上线基础

- 修正首页宣传口径和 metadata。
- 添加 canonical、Open Graph、Twitter Card、robots 和 sitemap。
- 给价格、FAQ、方案页设置独立 title/description。
- 准备至少 3 个不同 SKU 的授权案例。
- 建立品牌词与核心转化事件看板。

### Phase 1：首批可索引页面

- `/examples`
- `/solutions/ecommerce-clothing-video`
- `/solutions/social-media-clothing-video`
- `/guides/clothing-photo-to-video`
- `/guides/three-images-to-clothing-video`
- `/guides/clothing-video-without-back-image`

### Phase 2：渠道扩展

- Shopify、TikTok、Instagram 三个场景长尾页。
- AI 视频与传统拍摄对比页。
- 基于真实用户结果发布案例研究，而不是批量生成软文。
- 英文产品界面可用后，再建立 `/en` 站点与 hreflang。

## 10. 宣传渠道与内容素材

### 自有渠道

- 官网：首页、案例页、指南集群。
- 短视频账号：每条内容固定展示“三张原图 -> 生成设置 -> 最终成片”。
- 邮件：试用未完成、成片已完成、首次下载后三类生命周期邮件。

### 社群与合作

- 面向 Shopify、独立站、TikTok Shop 服装卖家社群投放真实案例。
- 与小型服装卖家、独立站服务商合作做可公开的 SKU 案例。
- 合作内容必须披露原始素材、生成规格和人工后期情况，避免把人工精修包装成一键效果。

### 付费测试

- 首轮只投品牌词、核心工具词和三图差异化词。
- 每个广告组对应一个搜索意图，不把“工具”“教程”“传统拍摄对比”混在同一广告组。
- 预算优化依据 `trial_job_created` 和 `deliverable`，不能只看注册数。

## 11. 核心指标

按以下漏斗判断宣传是否有效：

```text
landing_viewed
-> trial_cta_clicked
-> login_started
-> three_assets_selected
-> trial_job_created
-> deliverable
-> downloaded
-> paid_generation_started
```

首发重点观察：

- 首页主 CTA 点击率。
- 三图素材选择完成率。
- 点击试用到任务创建率。
- 任务可交付率与下载率。
- 每个关键词/渠道的可交付任务成本，而不是单纯注册成本。
- 真实案例页到试用的辅助转化率。

## 12. 上线前阻断条件

- 没有至少 3 个获授权的不同 SKU 案例时，不宣传“适用于多种服装品类”。
- 真实生成与支付链路未完成生产验收时，不投放大规模付费流量。
- Creem Moderation 未完成时，不开放包含自由文本 prompt 的生产生成链路。
- “最多 3 张”能力未实现前，不在广告、metadata 或页面中使用该说法。
- 不能用本地 10+ 次技术测试替代真实卖家样本，也不能据此声称“保证效果”。
