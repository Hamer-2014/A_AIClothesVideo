# 镜头模板库与规则引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 MVP 镜头模板库、模板可用性规则引擎、seed/upsert 和模板状态服务。

**Architecture:** 模板定义保存在代码 catalog 供 seed 使用，同时通过 Drizzle 写入 `shot_templates` 成为运营资产。规则引擎只根据素材完整度和模板状态输出可用性，不调用视觉模型或 DeepSeek。

**Tech Stack:** TypeScript, Drizzle, Vitest.

---

### Task 1: Catalog

**Files:**
- Create: `src/lib/templates/catalog.ts`
- Create: `src/lib/templates/types.ts`
- Create: `src/lib/templates/catalog.test.ts`

- [x] 定义 12 个 MVP 模板。
- [x] 每个模板包含数据库字段。
- [x] 免费试用只允许低风险模板。

### Task 2: Rules and Recommendations

**Files:**
- Create: `src/lib/templates/rules.ts`
- Create: `src/lib/templates/recommend.ts`
- Create: `src/lib/templates/recommend.test.ts`

- [x] 实现素材完整度输入。
- [x] 无背面禁用背面模板。
- [x] 无细节禁用细节模板。
- [x] 试用禁用中风险及以上模板。
- [x] 输出 risk warnings 和 available template IDs。

### Task 3: Seed and Status Service

**Files:**
- Create: `src/server/templates/seed.ts`
- Create: `src/server/templates/seed.test.ts`

- [x] 实现 memory store。
- [x] 实现 Drizzle store。
- [x] seed/upsert 幂等。
- [x] admin/operator 可更新状态。
- [x] 未授权角色不可更新状态。

### Task 4: Verification

**Commands:**
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

- [ ] 运行完整验证。
