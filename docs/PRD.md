# 服装商品图生成宣传短视频工具站 PRD

版本：MVP 草案  
日期：2026-06-05  
语言要求：项目文档与协作沟通默认使用中文。

相关文档：

- [技术架构方案](TECHNICAL_ARCHITECTURE.md)
- [实现计划](IMPLEMENTATION_PLAN.md)
- [开发 SPEC](DEVELOPMENT_SPEC.md)
- [Style Preset 风格预设设计](STYLE_PRESET_DESIGN.md)

## 1. 产品定位

本产品是一款面向跨境/独立站中小服装卖家的自助式商品短视频生成工具。用户上传服装产品图、多角度图、细节图或场景图后，系统根据素材完整度和 Style Preset 风格预设推荐安全镜头模板，用户可一键采用推荐方案或在高级调整中二次选择模板，确认分镜后生成 8/16/24 秒宣传短视频；付费用户还可在服务端开关开放时使用 40 秒 Beta。

MVP 的目标不是做“全自动广告大片工厂”，而是验证一个可付费、可控、可复现的最小生成闭环：

- 用户是否愿意上传真实 SKU 素材。
- 系统是否能稳定生成可下载的短视频。
- 用户是否愿意为 8/16/24 秒成片和 40 秒付费 Beta 购买点数。
- 失败率、重试率、模型成本是否支持可持续毛利。
- 哪些镜头模板最稳定、最受欢迎、最容易翻车。

## 2. 目标用户

MVP 优先服务跨境/独立站中小服装卖家，尤其是已有产品图但缺少短视频素材的卖家。

核心使用场景：

- 为单个服装 SKU 快速生成 8-40 秒固定规格宣传短视频。
- 输出用于 TikTok、Instagram Reels、YouTube Shorts、独立站商品页。
- 通过可控镜头模板降低服装细节漂移和人体异常风险。

暂不优先服务：

- 低价批量薅用量的国内平台商家。
- 需要客户协作、白标交付、项目管理的摄影/代运营工作室。
- 对广告大片质感、模特动作和材质还原要求极高的高端品牌。

## 3. MVP 范围

### 3.1 必做

- Google OAuth 登录。
- Email OTP/Magic Link 登录，邮件服务使用 Resend。
- 免费试用 + 点数包商业模式，支付默认使用 Creem。
- Creem Prompt Moderation，所有进入图片/视频生成链路的用户输入和最终生成 prompt 都必须先过审。
- 用户上传服装素材图片。
- Style Preset 风格预设，作为普通用户选择视频风格/用途的主入口。
- Lite/Standard/Strict 分级视觉识别与质检。
- 根据素材完整度生成推荐模板、可选模板、不可用模板。
- 系统根据 Style Preset、素材完整度和模板规则自动推荐镜头模板；用户可在高级调整中二次选择模板，系统给出推荐和禁用原因。
- DeepSeek 生成结构化分镜和提示词草稿。
- APIMart PixVerse V6 生成视频片段。
- 8/16/24 秒公开固定规格，以及受 `VIDEO_DURATION_40_ENABLED` 控制的 40 秒付费 Beta。
- 多个 8 秒片段拼接为一个完整视频。
- 生成后抽帧质检。
- Post-QA 抽帧质检策略，按 lite / standard / strict 分级控制成本和风险。
- 任务历史、下载、点数账单。
- 管理员后台查看用户、任务、异常、模型调用、成本、模板、点数流水。
- 多供应商 API Key 管理与 primary/fallback 路由。
- Creem、DeepSeek、视觉模型、APIMart PixVerse 视频模型在开发早期即真实接入，不做 mock 成功链路。

### 3.2 暂不做

- 自由时长，例如 13 秒、27 秒。
- 40 秒以上长视频，以及 40 秒 Beta 之外的自由长时长。
- 批量 SKU 自动生成。
- 360 度完整展示。
- 复杂真人走秀、缺少多视角依据的完整转身、剧情广告片。
- 公开售卖更高分辨率档位。
- 传统密码登录。
- 月订阅、企业套餐、团队协作。

## 4. 产品硬原则

1. 不生成图片中不存在的服装细节。
2. 没有背面图，不允许背面展示、转身、正背切换或 360 类镜头。
3. 没有细节图，不允许生成纽扣、拉链、刺绣、内衬、面料纹理等细节特写。
4. 有真人时，转身和大幅肢体动作属于高风险镜头；仅同一真人模特穿着同一件服装的多视角素材通过任务内一致性校验后，才允许在付费 Beta 的高级调整中明确选择受限转身模板。
5. DeepSeek 只能引用已启用镜头模板 ID，不能创造新镜头模板。
6. Style Preset 只能影响默认生成意图、prompt 风格基调和模板推荐排序，不能绕过素材规则、模板权限、试用限制和风险规则。
7. 用户看到的是完整视频任务；后台可以看到每个 8 秒片段。
8. 模型调用、状态变化、点数变化必须可追踪、可复现、可审计。

## 5. 视频规格与质量档位

MVP 只提供固定规格：

| 规格 | 片段数 | 用户用途 |
|---|---:|---|
| 8 秒基础版 | 1 个 8 秒片段 | 商品页动图、短广告测试、免费试用 |
| 16 秒标准版 | 2 个 8 秒片段 | 默认推荐，一个 SKU 的常规宣传短视频 |
| 24 秒增强版 | 3 个 8 秒片段 | 多角度/场景组合，质量控制压力更高 |
| 40 秒付费 Beta | 5 个 8 秒片段 | 长版商品宣传，按片段与转场强化质检 |

40 秒消耗 310 点，不开放免费试用。五个镜头槽位至少包含 3 种模板，同一模板最多出现 2 次、不得相邻重复，中高/高风险旋转或转身模板最多出现 1 次。

质量档位：

- 免费试用：低分辨率，带水印。
- 付费默认：高分辨率，无水印。
- 更高分辨率：不进入 MVP 公开售卖，仅后台/内测。

UI 限制：

- 用户侧 UI 不展示具体分辨率数值，例如 540p、720p、1080p、4K。
- 用户侧仅使用“低分辨率”“高分辨率”“更高分辨率”等质量档位表达。
- 具体供应商参数只允许出现在后台审计、任务调试、成本分析、技术文档和数据库字段中。

MVP 付费默认生成音频，用于提升 TikTok、Instagram Reels、YouTube Shorts 等短视频平台的开箱可用性。免费试用默认无音频，降低滥用和成本风险。用户侧只展示“包含音频 / 无音频”的质量差异，不展示具体供应商参数。

## 6. 素材输入规则

### 6.1 必传

- 商品正面图，推荐平铺图、白底图或模特正面图。
- 服装类别，例如上衣、裤子、连衣裙、外套、鞋包配饰。
- 目标比例：9:16、1:1、16:9。

### 6.2 强烈建议

- 背面图。
- 左/右侧图。
- 细节图：面料、领口、袖口、纽扣、拉链、印花等。
- 场景图或氛围参考图。

### 6.3 可选

- 模特图。
- 品牌 logo。
- 文案卖点。
- 色卡/尺码信息。

### 6.4 系统推断但需要用户确认

- 主色。
- 款式。
- 版型长短。
- 是否有明显图案。
- 是否支持背面、侧面、细节特写、场景化镜头。

## 7. 镜头权限规则

- 只有正面图：允许轻微推拉、平移、正面局部裁切、低风险正面展示；禁止转身、背面、360 展示。
- 有正面 + 背面：允许背面展示、正背切换；仍不承诺完整 360。
- 有正面 + 背面 + 侧面：允许更复杂多角度变化，但需要风险提示。
- 无真人商品图只有在正面/侧面/背面被识别为 `product` 且任务内多图一致性通过时，才允许商品轻旋转或连续 180° 半圈旋转；缺背面时禁止 180°。
- 真人模特素材不能复用无模特商品旋转模板；商品旋转模板不得生成真人、手、身体或虚拟模特，也不承担虚拟穿衣。
- 同一真人模特穿着同一件服装的 front/side 或 front/side/back 素材，只有在任务内服装一致性和可见模特一致性均通过后，才允许轻侧身 15-45° 或连续转身 180°；缺少对应视角、人物不一致或服装不一致时必须禁用。
- 单张正面真人模特图仍可使用 `model_front_pose`，但不能据此生成侧面、背面或转身。只有商品图时系统不得隐式造人。
- 虚拟穿衣不属于本轮模板能力。后续应作为独立上游模块显式生成模特穿衣素材；其输出仍须通过同服装、同模特的任务内一致性校验，才能复用真人模特动作模板。
- 有细节图：允许对应细节特写；无细节图时禁止凭空生成细节。
- 有场景图：允许场景化镜头；无场景图时只能使用通用模板场景，不允许生成强品牌或真实店铺背景。

生成前必须展示：

- 可生成镜头清单。
- 不可生成镜头清单。
- 每个禁用镜头的原因。
- 素材缺口建议。

## 8. 镜头模板库

模板库是产品规则和运营资产，不是前端写死的按钮列表。基础链路优先开放低风险和少量中风险模板；经多视角一致性校验、付费权限、高级调整明确选择和 Strict QA 共同约束的少量高风险模板，可按 Beta 开放，其余高风险模板后台默认关闭或仅内测。

普通用户默认通过 Style Preset 选择视频风格/用途；系统再根据 preset 偏好、素材完整度和模板规则自动推荐 1/2/3 个镜头模板，40 秒 Beta 则生成 5 个有序镜头槽位。模板选择仍然保留，但应作为高级调整能力展示。Style Preset 与模板的完整关系见 [Style Preset 风格预设设计](STYLE_PRESET_DESIGN.md)。

每个模板必须包含：

- `template_id`
- `version`
- `status`: draft / beta / active / paused
- `risk_level`
- `subject_kind`
- `required_assets`
- `consistency_requirements`
- `auto_select_allowed`
- `blocked_conditions`
- `allowed_motion`
- `base_prompt_intent`
- `system_constraints`
- `post_qa_checks`
- `is_trial_allowed`
- `requires_strict_review`

### 8.1 MVP 首批模板

| ID | 模板 | 素材要求 | 风险 | 试用 | 关键禁止 |
|---|---|---|---|---|---|
| `front_push_in` | 正面慢推近 | 正面图 | 低 | 是 | 禁止新增背面/袖口细节 |
| `front_pan` | 正面轻微平移 | 正面图 | 低 | 是 | 禁止改变版型、图案 |
| `product_float` | 商品悬浮展示 | 白底/平铺图 | 低 | 是 | 禁止真人化、禁止转身 |
| `model_front_pose` | 模特正面轻微姿态 | 模特正面图 | 中 | 否 | 禁止转身、禁止大幅肢体动作 |
| `front_crop_detail` | 正面局部裁切特写 | 正面图 | 低 | 是 | 只能裁切可见区域 |
| `fabric_macro` | 面料微距 | 面料细节图 | 中 | 否 | 禁止编造材质纹理 |
| `neckline_closeup` | 领口特写 | 领口图 | 中 | 否 | 禁止改变领型 |
| `cuff_closeup` | 袖口特写 | 袖口图 | 中 | 否 | 禁止添加纽扣/刺绣 |
| `print_closeup` | 印花图案特写 | 图案细节图 | 中 | 否 | 禁止图案漂移 |
| `back_display` | 背面展示 | 背面图 | 中 | 否 | 无背面图禁用 |
| `front_to_back_cut` | 正背切换 | 正面 + 背面 | 中高 | 否 | 禁止完整 360，禁止诡异转头 |
| `scene_lifestyle_showcase` | 场景氛围展示 | 正面 + 场景 | 中 | 否 | 场景只作背景/光线/氛围参考 |
| `minimal_studio` | 极简棚拍风 | 正面图，最好白底 | 低中 | 是 | 场景可变，服装不可变 |
| `product_quarter_rotation` | 商品轻旋转 15-45° | 同款无模特正面 + 侧面 | 中高 | 否 | 付费 Beta、Advanced-only、Strict QA；禁止造人和超出参考角度 |
| `product_half_rotation` | 商品连续 180° 转身 | 同款无模特正面 + 侧面 + 背面 | 高 | 否 | 付费 Beta、Advanced-only、Strict QA；禁止 360 和编造背面 |
| `model_quarter_turn` | 模特轻侧身 15-45° | 同一真人模特穿同一服装的正面 + 侧面 | 中高 | 否 | 付费 Beta、Advanced-only、Strict QA；禁止换脸、换体型和展示无依据背面 |
| `model_half_turn` | 模特连续转身 180° | 同一真人模特穿同一服装的正面 + 侧面 + 背面 | 高 | 否 | 付费 Beta、Advanced-only、Strict QA；禁止 360、人物漂移和人体异常 |

当前目录共 17 个模板。两个商品旋转模板和两个真人模特转身模板均为 `auto_select_allowed=false`，只在高级调整中由付费用户明确选择，不进入 Style Preset 自动编排。服务端确认阶段必须按模板主体分别校验商品或真人模特多视角一致性，按 front -> side -> back 写入素材快照，并强制 Strict QA。真人校验只比较当前任务内的可见人物，不建立人脸库或跨任务身份标识；这不替代上传者的肖像和素材授权义务。

### 8.2 模板扩展机制

- 新模板默认 `draft`，不能被普通用户使用。
- 管理员用内部素材测试。
- 达到成功率和质检通过率阈值后进入 `beta`。
- beta 阶段只对部分用户/部分套餐开放。
- 稳定后改为 `active`。
- 高失败率模板自动或手动降级为 `paused`。
- 每个模板统计使用次数、成功率、质检通过率、平均重试次数、平均成本、下载率、退款/投诉率。

## 9. 用户前台流程

登录后第一屏应该是生成工作台，不要堆砌营销式 AI 介绍。

生成工作台的默认主入口是 Style Preset，而不是要求普通用户先理解每个镜头模板。Preset 用来表达“极简棚拍”“电商主图动效”“社媒氛围短片”等用户可理解的风格/用途，模板推荐由系统自动完成。模板列表和不可用原因作为高级调整与透明解释保留。

### 9.1 页面

MVP 前台核心页面：

- Landing：首页/落地页。
- 生成工作台。
- 生成进度/任务详情。
- 任务历史。
- 点数账单。

### 9.2 生成流程

1. 用户上传素材。
2. 选择或沿用 Style Preset，例如极简棚拍、电商主图动效、社媒氛围短片。
3. 选择视频规格：8/16/24 秒；开关开放时可选择 40 秒付费 Beta。
4. 选择平台比例：9:16 / 1:1 / 16:9。
5. 系统分析素材。
6. 系统根据 preset、素材完整度和模板规则自动推荐模板组合。
7. 默认展示已选镜头摘要；用户可展开高级调整，查看推荐模板、可选模板、不可用模板和禁用原因。
8. DeepSeek 生成分镜草案。
9. 用户确认分镜、点数消耗和风险提示。
10. 系统冻结点数并提交生成。
11. 用户查看整体进度。
12. 生成完成后下载完整视频。

### 9.3 Style Preset 与模板选择

Style Preset 是普通用户的主选择项。MVP 首批 preset 建议：

| ID | 名称 | 适合场景 | 默认模板偏好 | 试用 |
|---|---|---|---|---|
| `minimal_studio` | 极简棚拍 | 独立站商品页、干净展示服装版型 | `minimal_studio`, `front_push_in`, `front_pan`, `front_crop_detail` | 是 |
| `marketplace_clean` | 电商主图动效 | 白底图、平铺图、商品页主图动效 | `product_float`, `front_pan`, `front_crop_detail`, `front_push_in` | 是 |
| `social_lifestyle` | 社媒氛围短片 | TikTok/Reels 测款，轻氛围表达 | `minimal_studio`, `front_push_in`, `front_pan`, `model_front_pose` | 谨慎 |

Preset 规则：

- 未选择 preset 时默认使用 `minimal_studio`。
- 免费试用入口默认 `mode=trial&preset=minimal_studio`。
- Preset 可以填充默认生成意图，并影响模板推荐排序。
- Preset 不能决定模板可用性，不能绕过无背面图、无细节图、无场景图和试用限制。
- `social_lifestyle` 没有场景图时不能生成强场景；没有模特正面图时不能启用模特动作模板。

模板分为：

- 推荐模板：素材满足要求、风险低、适合当前服装和当前 preset。
- 可选模板：素材满足要求，但风险稍高或不如当前 preset 优先。
- 不可用模板：缺少必要素材或风险过高，置灰并展示原因。

模板调整规则：

- 8 秒只能选择 1 个模板。
- 16 秒默认选择 2 个模板。
- 24 秒默认选择 3 个模板。
- 40 秒选择 5 个有序槽位，允许受控重复，但必须满足组合校验。
- 系统默认按 preset 自动选择对应数量的模板。
- 用户可在高级调整中删除推荐模板，也可添加其他可选模板。
- 不可用模板不能选择。
- 中高风险模板必须展示风险说明。
- DeepSeek 只能使用最终允许并被系统选中的模板 ID。

### 9.4 任务列表与片段展示

用户任务列表只显示完整视频任务，不默认显示每段 8 秒片段。

用户可见：

- 最终视频封面。
- 规格：8/16/24 秒或 40 秒付费 Beta。
- 比例。
- 状态：生成中、质检中、可下载、失败退款。
- 进度，例如“片段 2/3 生成中”。
- 下载完整视频。

后台必须能看到每个 8 秒片段，包括片段状态、模板、prompt、供应商任务 ID、视频 URL、成本、重试次数和质检结果。

## 10. 认证与登录

MVP 使用 better-auth。

支持：

- Google OAuth。
- Email OTP/Magic Link。
- 邮件服务：Resend。

暂不支持：

- 密码登录。

原因：

- 密码登录会引入忘记密码、重置密码、弱密码、防爆破、撞库等额外复杂度。
- 跨境/独立站用户通常接受 Google 登录和邮箱验证码。
- MVP 应优先验证视频生成与付费闭环，而不是扩展认证复杂度。

Email 登录建议：

- 优先 Email OTP。
- Magic Link 可作为邮件中的备用登录链接。
- OTP/Magic Link 有效期 10-15 分钟。
- 同邮箱 60 秒内只能发送一次。
- 同 IP 每小时限制发送次数。
- 登录邮件发送记录要保存成功/失败、错误码、provider message ID。
- 不在日志保存完整 token。

管理员后台：

- Google OAuth + 白名单邮箱。
- 角色：`admin`、`operator`。
- 所有后台操作写入审计日志。

### 10.1 素材权利声明与侵权处理

- 所有已登录用户的服务端图片上传必须主动接受当前版本 `image_rights_v1`，不得预选、静默继承或只在前端记录。
- 声明覆盖版权、商标和商业使用授权；图片中有可识别真人时，上传者必须拥有肖像及商业宣传授权；人物未满 18 周岁时还必须取得监护人授权。
- 声明、资产关联和任务级声明快照必须由服务端持久化，历史资产进入新任务前必须补签。
- 公开侵权通知入口为 `/takedown`，支持肖像、版权、商标、隐私等权利类型。
- 公开提交只创建待核验案件，不自动删除素材或视频，避免恶意投诉直接破坏用户数据。
- `operator` 只能分诊案件，`admin` 核验后才能结案；状态变化和处理结论必须写审计日志。
- 声明和投诉个人信息保留三年后去标识化，由内部 retention endpoint 定时执行；必要的非个人审计事实可继续保留。
- “不建立人脸库”不是产品合规替代品。真人模特 Beta 上线必须同时具备授权声明、投诉入口、人工处理和审计证据链。

## 11. 商业模式与点数

MVP 使用免费试用 + 点数包。

支付默认使用 Creem。站内维护点数账本，支付成功通过 webhook 入账。webhook 必须幂等，不能重复充值。

### 11.1 Creem Prompt Moderation

接入 Creem 后，必须接入 Creem Moderation。它用于支付平台合规和 NSFW/违规 prompt 风险控制，不能省略。

规则：

- 所有会进入图片或视频生成模型的用户输入，必须先调用 Creem `POST /v1/moderation/prompt`。
- 用户填写的卖点、场景描述、风格偏好、自由文本补充，都属于需要过审的 prompt 来源。
- DeepSeek 生成的最终视频 prompt 在提交视频模型前也必须过审，因为它会被发送给视频生成模型。
- `decision = allow` 时才允许继续。
- `decision = flag` 必须按 `deny` 处理，阻止生成。
- `decision = deny` 必须阻止生成。
- Creem Moderation 请求失败、超时或 5xx 时必须 fail closed，临时阻止生成，不能绕过继续生成。
- 审核应发生在冻结点数和提交视频模型之前，避免违规任务产生扣费争议。
- 每次审核保存 `external_id`、decision、Creem moderation id、关联 user/job/segment、时间和错误信息。

Creem Moderation 只负责文本 prompt 合规，不替代图片内容安全和生成后质检。图片 NSFW、违规图、人体异常、服装细节漂移仍由视觉模型和规则引擎处理。

### 11.2 免费试用

- 新用户送 1 次 8 秒基础版试用。
- 只允许低风险模板。
- 输出低分辨率。
- 带水印。
- 不开放高风险镜头、转身、背面展示、24 秒增强版和 40 秒 Beta。
- 必须登录并邮箱验证。
- 需要防滥用：user ID、email、OAuth provider ID、IP、user agent、设备指纹。
- 上线策略不使用 rolling 24h userId 作为唯一判断：同 userId、同 email、同 OAuth account 永久最多 1 次；同设备 7 天内最多 1 次；同 IP 24 小时最多 3 次；同 IP + user agent 24 小时最多 2 次。
- 风控拒绝时普通用户只看到统一试用不可用文案，内部 reason codes 和 hash 信号只允许管理员审计。

### 11.3 点数消耗建议

| 规格 | 输出 | 消耗点数 |
|---|---|---:|
| 8 秒基础版 | 高分辨率，无水印 | 70 点 |
| 16 秒标准版 | 高分辨率，无水印 | 130 点 |
| 24 秒增强版 | 高分辨率，无水印 | 190 点 |
| 40 秒付费 Beta | 高分辨率，无水印，5 个片段 | 310 点 |
| Strict/高保真质检 | 附加项 | 每 8 秒 +20 点 |

点数价格和消耗必须后台可配置，不要写死。

### 11.4 点数包建议

| 点数包 | 售价 | 点数 |
|---|---:|---:|
| Starter | 9.99 USD | 100 点 |
| Creator | 29.99 USD | 360 点 |
| Studio | 79.99 USD | 1100 点 |

### 11.5 点数状态

- `reserve`：用户确认分镜后冻结点数。
- `capture`：最终视频通过质检并交付后扣除。
- `release`：供应商失败或未生成取消时释放。
- `refund`：质检失败且无法交付时退款。
- `admin_adjust`：管理员手动调整，必须填写原因。

### 11.6 毛利要求

- 默认毛利目标：60%+。
- 最低可接受毛利：45%。
- 低于 45% 毛利的模型路线不能自动 fallback。
- 高成本模型只能用于高保真付费模式、管理员手动任务或内部测试。

## 12. 模型策略与路由

所有模型 provider/model/purpose 都必须支持后台配置。普通用户不选择具体模型，只选择视频规格、模板和质量模式。

MVP 采用真实接入策略：

- Creem checkout、webhook、Prompt Moderation 真实接入。
- DeepSeek `deepseek-v4-flash` 真实接入。
- 视觉识别/质检模型真实接入。
- APIMart `pixverse-v6` 作为默认试用视频生成模型真实接入。
- EvoLink `veo3.1-fast-beta` 保留为备用/对照路线，暂不作为默认公开视频生成模型。
- 不做“假成功”的 mock 生成链路。
- 未配置 API Key 时，对应功能显示不可用，不伪造成功结果。
- 所有真实调用必须写入 `provider_call_logs` 或对应审计表。
- development、staging、production 使用不同 key、额度和任务标记。
- 测试任务必须标记 `is_test = true`，后台与正式用户任务区分。

### 12.1 提示词/分镜模型

默认模型：

- `deepseek-v4-flash`

用途：

- 根据用户素材分析、可用模板、用户选择模板、视频时长生成结构化分镜。
- 生成视频模型 prompt 草稿。
- 生成用户可读分镜说明。

要求：

- 输出 JSON。
- 只能引用已启用 `shot_template` ID。
- 不能创造新镜头模板。
- 不能负责图片识别。
- 生成结果必须保存到数据库。

### 12.2 视觉素材识别/质检模型

默认模型：

- `gpt-5.4-mini` 或供应商等价的低成本 GPT 视觉模型。

可选升级：

- `gpt-5.4-nano`：Lite 预检。
- `gpt-5.5` 或供应商等价强模型：Strict 复核、高风险任务、申诉。
- `omni-moderation-latest`：内容安全审核。

要求：

- 必须支持 image input。
- 必须支持 text/JSON output。
- 最好支持 structured outputs / JSON schema。
- 图片必须作为图片输入传入，例如 `input_image.image_url`，不能只把图片 URL 当普通文本塞进 prompt。
- 视觉模型只输出观察结果，不直接决定能否使用模板；模板可用性由规则引擎判定。

输出示例：

```json
{
  "asset_role": "front",
  "garment_category": "dress",
  "view_angle": "front",
  "human_present": true,
  "visible_details": ["v_neck", "short_sleeve", "floral_print"],
  "not_visible_details": ["back", "inner_lining", "zipper_back"],
  "quality": {
    "blur": "low",
    "occlusion": "none",
    "lighting": "good"
  },
  "confidence": 0.86,
  "risk_flags": ["back_not_visible", "turnaround_not_allowed"]
}
```

### 12.3 视频生成模型

默认主模型：

- Provider：APIMart
- Model：`pixverse-v6`

用途：

- MVP 公开生成链路。
- 按 8 秒片段生成视频。
- 支持 8/16/24 秒最终成片和受开关控制的 40 秒付费 Beta，本质是 1/2/3/5 个独立 8 秒片段生成后拼接。

MVP 配置：

- 免费试用：低分辨率。
- 付费默认：高分辨率。
- 更高分辨率：仅后台/内测，不公开售卖。
- 付费默认生成音频；免费试用默认无音频；更高分辨率有声档仅后台/内测，不公开售卖。
- 异步任务 ID 必须保存。
- 输出链接必须及时下载并转存到 Cloudflare R2。
- 每个片段保存 prompt、模板 ID、输入素材快照、成本和状态。

备用/对照模型：

- Provider：EvoLink
- Model：`veo3.1-fast-beta`
- 用途：稳定性/成本对照、管理员手动任务或后续切回评估。
- 不自动启用，需运营确认稳定性和成本后再切换。

不默认启用：

- OpenRouter `google/veo-3.1`。
- 原因：成本偏高，不适合自动 fallback。

### 12.4 路由规则

- 每类任务有 primary provider/model 和 fallback provider/model。
- fallback 条件：429、5xx、超时、Key 余额不足、供应商不可用。
- 不触发 fallback：用户素材不合格、内容安全拦截、规则引擎禁用镜头、用户余额不足。
- fallback 前必须计算预计毛利。
- fallback 不能改变用户已确认的模板和分镜。
- 实验模型不能进入公开自动路由。
- 每次调用写入 `provider_call_logs`。
- Creem Prompt Moderation 不属于可选 fallback，公开视频生成链路必须调用。审核失败或不可用时阻止生成。

## 13. 任务状态机

用户可见状态：

- 上传素材。
- 素材检查中。
- 选择规格与镜头。
- 确认分镜与价格。
- 生成中。
- 质检中。
- 下载成片/查看失败原因。

后台真实状态示例：

- `draft_uploaded`
- `lite_check_running`
- `lite_check_passed`
- `asset_analysis_running`
- `asset_analysis_passed`
- `storyboard_draft_ready`
- `storyboard_confirmed`
- `prompt_moderation_running`
- `prompt_moderation_passed`
- `prompt_moderation_blocked`
- `credits_reserved`
- `segment_queued`
- `segment_generating`
- `segment_succeeded`
- `segment_failed`
- `stitching_queued`
- `stitching_running`
- `stitched`
- `post_qa_running`
- `deliverable`
- `retrying`
- `failed_refunded`

规则：

- 用户确认分镜后才冻结点数。
- Creem Prompt Moderation 通过后才冻结点数。
- 16/24/40 秒必须按 8 秒片段记录状态。
- 某个片段失败时重试该片段，不整单重跑。
- 质检决定是否交付。
- Post-QA 抽帧质检发生在拼接完成后、点数正式扣除前、用户可下载前。
- 每次状态变化写 `job_state_events`。

## 14. 技术架构

### 14.1 技术栈

- 前端/主站：Next.js。
- 部署：Vercel。
- 数据库：Neon Postgres。
- ORM/数据库访问：Drizzle。
- 认证：better-auth。
- UI：Tailwind CSS + Radix UI。
- 代码托管：GitHub。
- 定时任务触发：cron-job.org。
- 对象存储：Cloudflare R2。
- 视频拼接：Cloud Run `stitch-worker` + ffmpeg。
- 邮件：Resend。
- 支付：Creem。

### 14.2 异步任务方案

Vercel 只处理页面、用户 API、后台 API 和短任务推进，不负责长时间视频拼接。

任务推进：

- cron-job.org 定时请求内部 worker endpoint。
- cron-job.org MVP 触发频率默认为每 1 分钟。
- worker endpoint 领取少量待处理任务。
- 每次推进一步或几步，快到超时时停止。
- 数据库状态机是唯一真实来源。
- 所有 worker 操作需要任务锁，例如 `locked_until`。
- 每个片段提交视频模型时必须有幂等键。

Cloud Run 负责：

- 下载 R2/供应商片段视频。
- ffmpeg 拼接/转码。
- 拼接完成后优先在同一 worker 内抽帧。
- 上传最终视频到 R2。
- 更新 `stitch_jobs` 和 `video_jobs` 状态。

Cloud Run 触发方式：

- Next.js/worker tick 创建 `stitch_job`。
- 主应用通过内部受保护请求触发 Cloud Run 执行具体 stitch job。
- Cloud Run 不作为 MVP 主动轮询数据库的常驻 worker。
- Cloud Run worker 源码入口位于 `workers/stitch-worker/`，部署文档入口为 `docs/deployment/cloud-run-stitch.md`。
- 主应用触发 Cloud Run 的代码入口为 `src/server/stitch/trigger-cloud-run.ts`。

不要在 Vercel Function 内跑 ffmpeg。

### 14.3 Post-QA 抽帧质检策略

生成后质检位置：

```text
Veo 片段生成完成 -> Cloud Run 拼接完整视频 -> 抽帧质检 -> 通过后扣除冻结点数 -> 用户可下载
```

原则：

- 抽帧质检检查最终成片，不只检查单个片段。
- 抽帧优先在 Cloud Run 拼接 worker 内完成，避免最终视频上传后再下载造成额外传输。
- 普通用户不能关闭质检。
- 管理员/内测任务可以配置 `post_qa_mode = off`。
- 免费试用和低风险 8 秒任务默认 `lite`。
- 16/24/40 秒付费任务默认 `standard`。
- 有真人素材、背面展示、正背切换、中高风险模板和四个旋转/转身付费 Beta 强制 `strict`。
- 质检失败后进入自动重试、人工审核或退款流程。
- 点数 `capture` 必须发生在质检通过后。
- 前台文案只能表达“包含质量检查”，不能承诺 100% 无异常。

建议配置：

| 模式 | 抽帧策略 | 模型策略 | 适用场景 |
|---|---|---|---|
| `off` | 不抽帧 | 无 | 仅管理员内测 |
| `lite` | 8 秒抽 2-3 帧 | 低成本视觉模型 | 免费试用、低风险 8 秒 |
| `standard` | 每 8 秒抽 4-5 帧 | 默认视觉模型 | 付费默认 |
| `strict` | 每 8 秒抽 6-8 帧 + 转场帧 | 强视觉模型复核 | 真人、背面、正背切换、高风险模板 |

主要成本：

- Cloud Run 抽帧计算成本。
- 抽帧图 R2 存储成本。
- 视觉模型调用成本。
- 质检失败后的片段重试、重新拼接和再次质检成本。

40 秒 Standard 固定抽取 24 帧，Strict 固定抽取 34 帧，按 5 个片段批次加 1 个转场批次调用视觉模型。仅当一个片段被精确定位为失败且转场通过时，自动重试该片段一次；重试耗尽、多段失败、转场失败或供应商异常才进入失败释放点数流程。
- 用户等待时间。

抽帧本身通常不是最大成本，视觉模型和失败重试才是毛利风险。

## 15. Cloudflare R2 文件生命周期

R2 bucket 默认不公开。所有用户下载和模型访问都使用短期 signed URL。

### 15.1 文件路径

```text
/users/{userId}/assets/{assetId}/original.{ext}
/users/{userId}/assets/{assetId}/thumb.webp
/jobs/{jobId}/segments/{segmentId}/video.mp4
/jobs/{jobId}/stitched/final.mp4
/jobs/{jobId}/qa/frames/{frameIndex}.jpg
/jobs/{jobId}/covers/cover.webp
```

### 15.2 生命周期

| 文件类型 | 默认保存 |
|---|---:|
| 用户上传原图 | 180 天 |
| 缩略图/预览图 | 跟随原图 |
| Veo 8 秒片段视频 | 30 天 |
| 异常/申诉任务片段 | 90 天 |
| 最终交付视频 | 180 天 |
| 抽帧质检图/调试文件 | 30 天 |
| 异常任务质检图 | 90 天 |

删除策略：

- 数据库先标记 `deleted_at`。
- 后台清理任务异步删除 R2 文件。
- 删除动作写审计日志。
- 用户点击删除时不直接同步删除 R2。
- 账号删除需清理用户资产、任务视频、缩略图、质检图；订单/账务审计保留必要记录。

## 16. 管理员后台

后台定位为运营审计、成本控制和异常处理工具，不是只有统计卡片的 dashboard。

MVP 模块：

- 总览 Dashboard。
- 用户管理。
- 任务管理。
- 异常任务队列。
- 模型调用日志。
- 供应商与 Key 管理。
- 镜头模板管理。
- 点数与订单管理。
- 内容安全与滥用控制。

任务详情必须能看到：

- 上传素材。
- 素材识别 JSON。
- 推荐/可选/禁用模板。
- 用户选择的模板。
- DeepSeek 分镜 JSON。
- 每个 8 秒片段状态。
- 每段视频 prompt。
- 每段供应商任务 ID。
- 拼接结果。
- 抽帧质检结果。
- 状态流转日志。

管理员操作：

- 手动重试某个片段。
- 标记可交付。
- 对已失败任务释放冻结点数或按退款流程处理。
- 暂停用户。
- 下载调试素材。
- 添加内部备注。

## 17. 核心数据模型

PRD 级核心实体：

- `users`
- `user_profiles`
- `admin_users` / `roles`
- `assets`
- `asset_analyses`
- `shot_templates`
- `shot_template_metrics`
- `video_jobs`
- `video_job_assets`
- `storyboards`
- `video_segments`
- `stitch_jobs`
- `post_qa_results`
- `credit_wallets`
- `credit_ledger`
- `orders`
- `model_providers`
- `provider_call_logs`
- `prompt_moderation_results`
- `rights_attestations`
- `asset_rights_attestations`
- `rights_removal_requests`
- `job_state_events`
- `admin_audit_logs`
- `abuse_events`

设计原则：

- 点数必须用流水账，不只改余额。
- 片段必须单独建表，不藏在任务 JSON。
- MVP 视频生成 provider/model/key 只由环境变量决定：`VIDEO_GENERATION_PROVIDER`、`VIDEO_GENERATION_MODEL`、当前 provider 对应的 `APIMART_API_KEY` 或 `EVOLINK_API_KEY`。数据库 `model_routes` / `provider_keys` 不决定公开视频生成链路。
- 模型调用必须单独记录，不只写错误日志。
- Prompt moderation 必须单独记录，方便 Creem review、申诉和合规审计。
- 模板必须版本化，不改旧模板影响历史任务复现。
- 用户可见状态和后台真实状态分开。
- 所有供应商输入输出都要有快照，方便复现和申诉处理。

## 18. UI/UX 方向

UI 目标是安静、专业、工具化，不要强烈“AI 味”。这是一个给卖家重复使用的工作台，不是炫技型 AI 展示页。

原则：

- 登录后主任务是“创建视频”。
- 生成工作台占据主舞台。
- 不堆叠大量卡片。
- 不做夸张渐变和 AI 感装饰。
- 模板推荐要展示具体原因。
- 不可用模板要展示缺少什么素材。
- 状态、扣费、退款要清楚。
- 管理后台以表格、筛选、详情抽屉、日志为主。

推荐风格：

- Minimal Premium SaaS。
- 中性色为主，少量品牌强调色。
- Tailwind CSS + Radix UI。
- 图标使用 lucide 或一致的 SVG 图标库。
- 所有交互控件有 loading、disabled、error、focus 状态。

## 19. MVP 成功指标

功能验证：

- 上传完成率。
- 预检通过率。
- 分镜确认率。
- 视频生成成功率。
- 质检通过率。
- Post-QA 模式分布。
- Post-QA 平均成本。
- 平均重试次数。
- 单视频平均成本。
- 用户下载率。

商业验证：

- 免费试用转付费率。
- 点数包购买率。
- 付费用户复购率。
- 每个付费用户平均生成视频数。
- 单任务毛利。
- 退款率。

获客验证：

- 目标用户访谈数。
- 注册转上传率。
- 上传转生成率。
- 生成转下载率。
- 下载后是否实际发布到 TikTok/Reels/商品页。

建议 MVP 小规模验证目标：

- 找到 20-50 个真实跨境服装卖家。
- 收集 100-300 个真实 SKU 生成任务。
- 找到最稳定的 5-8 个模板。

当前本地技术验证记录：

- 截至 2026-06-13，开发者本地已生成 10+ 个视频，平台链路表现稳定。
- 该记录可作为技术稳定性初步证据，但不能替代 20-50 个目标用户和 100-300 个真实 SKU 的公开 MVP 验证。

## 20. 待后续确认

- Creem 点数包实际价格与税务配置。
- Creem Moderation 生产环境 key、测试用例、review 要求。
- APIMart `pixverse-v6` 生产/准生产成功率、耗时、成本和音频参数稳定性。
- PixVerse V6 内测模板和对比指标。
- 视觉模型实际 provider：官方 OpenAI、APIMart、EvoLink 或其他 OpenAI-compatible provider。必须真实接入，不做 mock 成功链路。
- Cloud Run 拼接 worker 的资源配置。
- Post-QA 每种模式的模型成本上限和 strict 转场帧策略。
- R2 signed URL 过期时间和清理任务频率。
- 管理员后台首版权限细节。
