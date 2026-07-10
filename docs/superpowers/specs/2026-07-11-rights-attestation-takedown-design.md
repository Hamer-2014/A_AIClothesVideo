# 素材与肖像授权声明、侵权删除入口设计

日期：2026-07-11
状态：用户确认方向后的书面规格，待最终复核
关联文档：[PRD](../../PRD.md)、[技术架构](../../TECHNICAL_ARCHITECTURE.md)、[开发 SPEC](../../DEVELOPMENT_SPEC.md)、[README/40 秒/旋转模板设计](2026-07-10-readme-40s-rotation-templates-design.md)

## 1. 背景与目标

项目将开放商品旋转和真人模特转身类付费 Beta。现有服务条款只笼统要求用户不得上传无权使用的人像，隐私政策只说明用户可以请求删除，没有以下可执行能力：

- 用户主动确认素材、肖像和商业宣传授权。
- 服务端保存不可由前端绕过的声明记录。
- 对未成年人模特取得监护人授权的明确声明。
- 权利人可公开访问的侵权或隐私删除入口。
- 可追踪的投诉编号、后台处理状态和管理员审计记录。
- 邮件兜底和生产环境配置检查。

本设计建立两条独立链路：

```text
用户上传与生成
-> 主动勾选权利声明
-> 服务端校验声明版本
-> 保存声明并绑定资产
-> 创建任务时保存声明快照

第三方权利人投诉
-> 公开表单
-> 服务端校验、限流和去敏
-> 保存案件并返回公开编号
-> 后台人工核验
-> 记录处理结果和审计日志
```

这是一套产品和工程控制，不代替上线地区的专业法律审查。真人模特付费 Beta 对外开放前，最终条款文本仍应由法律专业人士确认。

## 2. 核心决策

- 采用“结构化表单 + 后台队列 + 邮箱兜底”，不采用只有 `mailto:` 的不可追踪方案。
- 所有发送到服务端的用户素材都需要权利声明，不只限制真人模特图片。
- 游客本地选择的图片尚未离开浏览器，不强制立即声明；登录后真正上传前必须声明。
- 声明复选框不得预选，客户端和服务端都必须校验。
- 已存在但没有声明记录的历史资产不能直接进入新的生成任务，用户需要重新确认。
- 投诉提交只创建待核验案件，不自动删除或冻结内容，避免恶意下架。
- 后台处理人可以记录资源、核验和处理结果；只有管理员可以把案件最终标记为已删除或已驳回。
- MVP 不接收投诉附件，避免恶意文件、病毒和新的敏感数据存储面。
- 不建立人脸特征库，不做跨任务身份识别，不把声明记录解释为人脸识别同意。

## 3. 权利声明

### 3.1 当前声明版本

声明版本固定为：

```text
image_rights_v1
```

中文复选框文本：

```text
我确认拥有或已获得上传素材的版权、商标及商业使用授权；如素材包含可识别人物，我已获得其肖像和商业宣传授权；如人物未满 18 周岁，我已获得其监护人授权。我不会将素材或生成结果用于冒充代言、色情化、政治宣传或其他违法误导用途。
```

声明旁必须链接到 `/terms` 和 `/privacy`，但不得用“继续即同意”代替主动勾选。

### 3.2 声明触发点

上传面板在用户登录并准备发送文件到服务端时显示声明：

- 未勾选时，服务端上传按钮或文件发送动作不可继续。
- 用户可以先以游客身份在浏览器本地选择图片。
- 登录后恢复本地草稿并上传时必须重新显示声明，不沿用匿名本地状态作为审计证据。
- 一次批量上传共享一条声明记录，每个创建的资产分别关联该声明。
- 单文件上传同样创建一条声明记录。

前端状态只改善体验，真正门禁在 `POST /api/uploads/presign`。

### 3.3 上传 API

单文件和批量上传请求都必须包含：

```json
{
  "rightsAttestation": {
    "accepted": true,
    "version": "image_rights_v1"
  }
}
```

服务端行为：

- 缺少声明：返回 `400 rights_attestation_required`。
- `accepted` 不是 `true`：返回 `400 rights_attestation_required`。
- 版本不是当前版本：返回 `409 rights_attestation_version_mismatch`，前端重新展示最新文本。
- 声明记录、资产记录和资产关联必须在同一数据库事务中创建。
- 单文件和批量上传创建的资产都先使用 `pending_upload`；只有 `/api/uploads/complete` 验证上传完成后才改为 `uploaded`，不能在文件真正到达 R2 前提前标记成功。
- 数据库写入失败时不得签发上传 URL。
- Provider 或 R2 签名失败时保留 `pending_upload` 资产的现有补偿语义，但声明记录仍作为用户操作证据保留。

### 3.4 历史资产重新确认

新增已登录接口：

```text
POST /api/assets/attest-rights
```

输入包含当前声明和最多 8 个资产 ID。服务端必须确认资产属于当前用户且未删除，然后用一条 `generation_reconfirmation` 声明关联这些资产。

Preflight 和任务创建双重检查所有选中资产：

- Preflight 返回 `rights_attestation_required` 以及缺少声明的资产 ID。
- 任务创建 API 再次查询，缺少声明时拒绝创建任务，不冻结点数。
- 创建成功时在任务上保存声明快照，防止资产后续删除导致审计链断裂。

### 3.5 数据模型

新增 `rights_attestations`：

```text
id
user_id
version
statement_snapshot
scope = upload | generation_reconfirmation
locale
ip_hash
user_agent_hash
accepted_at
created_at
```

新增 `asset_rights_attestations`：

```text
id
asset_id
rights_attestation_id
created_at
unique(asset_id, rights_attestation_id)
```

`video_jobs` 新增 `rights_attestation_snapshot` JSON，至少保存：

```json
{
  "version": "image_rights_v1",
  "assetIds": ["..."],
  "attestationIds": ["..."],
  "verifiedAt": "ISO-8601"
}
```

IP 和 User-Agent 使用 `ABUSE_HASH_SECRET` 做 HMAC 摘要，不保存原始 IP。生产环境缺少摘要密钥时 fail closed；个人本地开发可保存 `null` 摘要，但不能退回存原始 IP。

## 4. 侵权删除入口

### 4.1 公开页面

新增：

```text
GET /takedown
```

页脚、服务条款和隐私政策都链接到该页面。页面说明这是权利通知入口，不承诺提交即自动删除，也不公开其他案件。

表单字段：

- 举报人姓名：2-100 字符。
- 联系邮箱：标准邮箱格式，最多 254 字符。
- 权利类型：`likeness`、`copyright`、`trademark`、`privacy`、`other`。
- 涉及内容：1-5 个 URL 或站内任务/内容引用，每项最多 500 字符。
- 权利说明：50-5000 字符。
- 诚信声明：必须勾选，确认信息真实且有权代表相关权利人。
- 准确性声明：必须勾选，确认理解虚假通知可能造成责任。
- 隐藏蜜罐字段：正常用户必须为空。

不提供附件上传。需要补充证明材料时，由后台人员通过已配置的法律联系邮箱与提交人沟通。

### 4.2 提交 API

新增：

```text
POST /api/compliance/rights-removal
```

服务端处理顺序：

1. 限制请求体大小并解析结构化字段。
2. 拒绝蜜罐字段非空的请求，但返回通用响应，避免向机器人暴露规则。
3. 使用 `ABUSE_HASH_SECRET` 计算 IP 摘要。
4. 同一 IP 摘要 24 小时最多提交 5 次；超限返回 `429`。
5. URL 只保存 origin + pathname，移除 query 和 fragment，避免保存 signed URL token。
6. 在数据库创建案件并生成不可枚举的公开编号。
7. 数据库成功后，尝试通过 Resend 通知 `LEGAL_CONTACT_EMAIL`。
8. 邮件失败不回滚已保存案件；记录失败日志，仍向提交人返回受理编号。
9. 数据库失败返回 `503`，不得返回虚假受理成功。

成功响应：

```json
{
  "accepted": true,
  "reference": "RR-随机不可枚举编号"
}
```

公开 API 不提供根据编号查询案件详情，避免枚举、隐私泄露和社工攻击。

### 4.3 数据模型

新增 `rights_removal_requests`：

```text
id
public_reference
status
reporter_name
reporter_email
rights_type
content_references
description
good_faith_confirmed
accuracy_confirmed
ip_hash
user_agent_hash
resolution_summary
resolved_at
created_at
updated_at
```

状态：

```text
received
triaging
awaiting_information
action_required
resolved_removed
resolved_rejected
```

`public_reference` 必须唯一且由加密安全随机源生成，不能使用自增序号或时间戳直接推导。

## 5. 后台处理

新增后台页面：

```text
/admin/rights-removal
```

列表展示公开编号、状态、权利类型、创建时间和是否超出待处理阈值。详情展示举报人信息、去敏后的内容引用、说明、状态历史和处理记录。

权限：

- `operator` 可以把 `received` 更新为 `triaging`、`awaiting_information` 或 `action_required`。
- 只有 `admin` 可以更新为 `resolved_removed` 或 `resolved_rejected`。
- 所有状态更新必须填写至少 6 个字符的处理原因。
- 每次更新写 `admin_audit_logs`，target type 为 `rights_removal_request`。
- 最终状态必须填写 `resolution_summary`，但不得在普通用户页面公开。

案件不会因为提交而自动删除内容。管理员核验权利基础和目标资源后，通过既有运维或后续内容清理能力完成删除，再记录 `resolved_removed`。在自动化 R2 删除能力完成之前，后台不得伪装成已经自动清理对象存储。

## 6. 邮件与环境配置

新增环境变量：

```dotenv
LEGAL_CONTACT_EMAIL=
```

复用：

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
ABUSE_HASH_SECRET
```

`/api/health` 新增 `legalCompliance` 检查：

- 生产和 staging 必须有 `LEGAL_CONTACT_EMAIL`、`RESEND_API_KEY`、`RESEND_FROM_EMAIL` 和 `ABUSE_HASH_SECRET`。
- 本地开发允许邮件未配置，但公开表单仍应通过内存/测试依赖验证，不能返回假发送成功。

## 7. 法律页面与用户文案

### 7.1 服务条款

补充：

- 可识别人物的肖像和商业宣传授权。
- 未成年人需要监护人授权。
- 禁止冒充代言、身份操纵、色情化、政治宣传和违法误导。
- 用户声明不限制真实权利人提交删除请求。
- `/takedown` 和法律联系邮箱入口。

### 7.2 隐私政策

补充：

- 素材会被第三方模型 Provider 处理的范围。
- 权利声明记录及其目的。
- 投诉表单收集的姓名、邮箱、说明和摘要化网络信号。
- 只有后台授权人员可以访问投诉内容。
- 声明记录在相关资产/任务删除后最多保留 3 年，用于争议与合规审计。
- 投诉案件在关闭后最多保留 3 年，之后删除或去标识化；法律要求更长时除外。

### 7.3 FAQ 与页脚

FAQ 解释：

- 上传真人模特图需要什么授权。
- 儿童模特需要什么授权。
- 如何投诉无授权素材或申请删除。

页脚新增“侵权删除”链接。

## 8. 错误处理与安全边界

- 声明缺失、版本过期和资产不属于用户都在点数冻结前阻止。
- 不把 IP、User-Agent、举报人邮箱或完整说明写入 Provider 日志和普通访问日志。
- 不在前端错误中暴露其他用户、资产或案件是否存在。
- 投诉内容按不可信输入处理；后台页面转义显示，不渲染提交者提供的 HTML。
- URL 去除查询参数和片段后再保存、展示和发送邮件。
- 邮件通知是案件保存后的副作用，失败不丢案件。
- 数据库不可用时 fail closed，不降级为只发邮件。
- 投诉不触发自动删除，最终删除决定必须有人审查和审计。
- 不能因为用户勾选声明就放松 Creem Moderation、素材一致性检查或模板权限。

## 9. 测试与验收

### 9.1 自动化测试

- 上传 Presign 缺少、拒绝或使用旧声明版本时失败。
- 单文件和批量上传在同一事务中创建声明和资产关联。
- 历史资产重新确认只能操作本人资产。
- Preflight 和任务创建对缺少声明的资产 fail closed。
- 任务保存完整声明快照。
- 投诉字段长度、邮箱、枚举、声明、蜜罐和请求体限制。
- URL query/fragment 被移除，signed token 不进入数据库和日志。
- 同一 IP 摘要 24 小时第 6 次提交被限流。
- 数据库失败返回 503；邮件失败仍返回已保存案件编号。
- 公开编号不可预测并保持唯一。
- operator 不能最终关闭案件，admin 可以并写审计日志。
- 条款、隐私、FAQ、页脚和 `/takedown` 页面包含必要入口。
- 原有游客本地选图、登录上传、任务创建和免费试用流程回归通过。

### 9.2 手动验收

- 游客本地选择图片后登录，确认上传前出现未预选声明。
- 已登录用户未勾选时无法上传，直接调用 API 也被拒绝。
- 历史资产在生成前被提示重新确认，确认后可继续。
- 提交一个真实格式投诉，页面显示受理编号，后台出现案件。
- 关闭 Resend 配置模拟邮件失败，案件仍保存在后台。
- operator 完成初审但不能标记最终删除，admin 可以完成并看到审计日志。
- 页面和邮件中不出现 signed URL 查询参数、IP 原文或内部存储 Key。

## 10. 发布门槛

真人模特付费 Beta 开放前必须满足：

- 当前声明版本和法律页面已经部署。
- 上传 API 与任务创建 API 都执行服务端声明检查。
- `/takedown` 可公开访问并能真实保存案件。
- `LEGAL_CONTACT_EMAIL` 和 Resend 通知经过真实环境验证。
- 后台可以查看、分派状态并记录最终处理结果。
- 至少完成一次“提交 -> 核验 -> 记录删除处理 -> 审计复核”演练。
- 生产环境不存在 `ABUSE_HASH_SECRET` 缺失或原始 IP 落库。

## 11. 非目标

- 不提供法律裁决或保证投诉成立。
- 不自动接受投诉并删除内容。
- 不在 MVP 上传身份证、人脸证明、授权书附件或其他高敏感证明材料。
- 不建立公开案件查询门户。
- 不实现跨任务人脸识别、面部 embedding 或人物身份库。
- 不在本设计中实现完整 R2 对象删除 worker；后台必须如实记录人工或既有运维处理结果。
- 不因为声明存在而绕过内容审核、素材权限和生成质量检查。
