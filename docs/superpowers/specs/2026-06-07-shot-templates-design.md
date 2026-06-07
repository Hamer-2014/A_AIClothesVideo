# 镜头模板库与规则引擎设计

## 目标

实现 12 个 MVP 镜头模板、素材完整度到模板可用性的规则引擎、模板 seed/upsert 和模板状态更新服务。本阶段不做后台页面、不接视觉模型、不接 DeepSeek。

## 设计

- `src/lib/templates/catalog.ts` 定义 12 个 MVP 模板完整元数据。
- `src/lib/templates/rules.ts` 根据素材完整度输出禁用原因和风险提示。
- `src/lib/templates/recommend.ts` 输出推荐、可选、不可用模板和 `availableTemplateIds`。
- `src/server/templates/seed.ts` 提供 memory store、Drizzle store、seed/upsert 和状态更新服务。

## 决策

- 免费试用只允许 `riskLevel = low` 模板。
- `minimal_studio` 按保守规则设为 `medium`，不允许免费试用。
- `front_to_back_cut` 设为 `medium_high`，强制 strict review。
- 后台暂停模板本阶段只做服务层能力，后续后台 UI 接入。

## 验收

- 12 个模板 ID 完整且唯一。
- 无背面图禁用背面展示和正背切换。
- 无细节图禁用所有细节特写。
- 试用只允许低风险模板。
- draft/paused 模板不可用。
- seed 可重复执行且不重复插入。
- admin/operator 可更新模板状态，未知角色不可更新。
