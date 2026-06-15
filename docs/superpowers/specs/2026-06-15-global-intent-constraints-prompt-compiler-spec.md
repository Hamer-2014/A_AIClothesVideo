# Global Intent / Constraints Prompt Compiler SPEC

## 背景

当前视频生成链路里，“生成意图”作为 `userPrompt` 进入 DeepSeek 分镜阶段。DeepSeek 会生成每个 8 秒片段的 `segment.prompt`，确认分镜后这些 prompt 写入 `video_segments.prompt`，视频模型提交时直接使用 `segment.prompt`，只在有 scene asset 时追加图片角色说明。

这带来两个风险：

1. 用户全局意图可能只被 DeepSeek 部分吸收，16/24 秒多片段视频里后续片段可能弱化或丢失意图。
2. 如果让 DeepSeek 同时生成“全局约束”和“分段 prompt”，约束与分段 prompt 可能互相矛盾，视频模型收到冲突指令后不可控。

本 SPEC 要把约束所有权从 DeepSeek 手里拿回来：系统生成并强制持有全局硬约束，DeepSeek 只在约束内生成分段创意，最终提交给视频模型的每个片段 prompt 都由系统编译。

## 目标

- 每个视频生成请求的最终 prompt 固定由三段组成：
  1. `GLOBAL HARD CONSTRAINTS`
  2. `GLOBAL USER INTENT`
  3. `SEGMENT INSTRUCTION`
- `GLOBAL HARD CONSTRAINTS` 只由系统规则、素材分析、模板策略生成，DeepSeek 不能生成或改写。
- `GLOBAL USER INTENT` 由系统从用户生成意图中提炼成短摘要，不能直接把用户原文无节制塞给视频模型。
- `SEGMENT INSTRUCTION` 由 DeepSeek 在模板和约束内生成，每个片段不同。
- DeepSeek 分镜输入必须包含硬约束和用户意图摘要，避免生成内容与约束相背离。
- 视频模型提交阶段必须再次追加同一套硬约束和用户意图摘要，避免只依赖 DeepSeek 自觉贯彻。
- 后台和 provider log 必须能看到最终 prompt 编译证据，方便排查是 DeepSeek 分段问题还是系统拼装问题。

## 非目标

- 不重新设计素材分析模型。
- 不让用户自由编辑完整最终视频 prompt。
- 不把模板规则交给 DeepSeek 判断。
- 不引入新的数据库表，优先复用 `storyboards.final_prompt_snapshot`、`video_segments.prompt` 和 `provider_call_logs.request_snapshot`。
- 不实现复杂 NLP 意图分类器；MVP 可以先用保守规则和有限字段提炼。
- 不改变 env-only APIMart PixVerse V6 公开视频运行时配置。

## 核心原则

最终优先级固定为：

```text
系统硬约束
> 素材可见事实
> 模板可用性规则
> 用户全局意图
> DeepSeek 分段创意
> 模板 base_prompt_intent
```

冲突时，上层永远胜出。

DeepSeek 只能生成 `SEGMENT INSTRUCTION`，不能生成 `GLOBAL HARD CONSTRAINTS`，不能把禁用模板重新启用，不能创造未选择模板 ID。

## 术语

### GlobalHardConstraints

系统生成的硬约束数组，来源包括：

- 素材完整度：是否有正面、背面、细节、场景图。
- 素材分析事实：服装类别、可见颜色、可见图案、可见结构。
- 模板策略：无背面禁用背面展示/转身/360；无细节图禁用细节特写。
- 产品策略：不得编造素材不存在的服装细节；场景图只能作背景/光线/氛围参考。

示例：

```json
[
  "Do not invent garment details not visible in the uploaded assets.",
  "Keep garment color, silhouette, visible pattern, and construction consistent with the garment reference images.",
  "Do not show the back side because no back asset is available.",
  "Do not use turn-around, 360 display, or front-to-back transition.",
  "Use scene images only as background, lighting, and mood reference.",
  "Do not copy people, faces, logos, storefront names, or readable text from scene images."
]
```

### GlobalUserIntent

系统从用户“生成意图”提炼出的短摘要，不是 DeepSeek 自由生成的新规则。

建议结构：

```json
{
  "sourcePromptSummary": "高级独立站商品页风格，突出裙摆层次和面料质感，不要真人走秀。",
  "styleIntent": "premium clean ecommerce product video",
  "sellingPoints": [
    "emphasize visible skirt silhouette",
    "show visible fabric layering"
  ],
  "negativeIntent": [
    "avoid runway-walk presentation"
  ]
}
```

MVP 可先用规则实现：

- 原始用户输入保存短摘要，不保存过长全文到最终 prompt。
- 常见中文/英文风格词映射为简洁英文短句。
- 找不到明确意图时使用空数组或通用 `clean ecommerce product video`，不要让系统编造卖点。
- 用户意图必须被素材事实降级。例如用户要求“面料微距”，但无细节图时，只能变成 `emphasize visible fabric texture from provided full garment images`，不能生成 macro close-up。

### SegmentInstruction

DeepSeek 生成的单段镜头 prompt。它应包含模板动作、镜头节奏、可见素材表达方式，但必须服从全局硬约束和模板可用性。

模板和 `SegmentInstruction` 的关系：

- 模板决定镜头类型、需要素材、禁用条件和 `base_prompt_intent`。
- DeepSeek 根据已选择模板和用户意图生成该段 `SegmentInstruction`。
- 模板不生成全局硬约束。
- 系统硬约束不由模板覆盖。

## 目标最终 prompt 格式

提交给 APIMart/PixVerse 的每个片段 prompt 必须由系统编译为：

```text
GLOBAL HARD CONSTRAINTS:
- Do not invent garment details not visible in the uploaded assets.
- Keep garment color, silhouette, visible pattern, and construction consistent with the garment reference images.
- Do not show the back side because no back asset is available.

GLOBAL USER INTENT:
- Premium clean ecommerce product video.
- Emphasize visible skirt silhouette and fabric layering.
- Avoid runway-walk presentation.

SEGMENT INSTRUCTION:
Slow front-facing push-in shot of the garment, keeping the full silhouette centered and stable.
```

注意：

- 这是结构格式，不是固定文案。
- `GLOBAL HARD CONSTRAINTS` 每段都带。
- `GLOBAL USER INTENT` 每段都带。
- `SEGMENT INSTRUCTION` 每段不同。
- 如果某段有 scene asset，现有图片角色说明应并入 `GLOBAL HARD CONSTRAINTS` 或放在其后、`SEGMENT INSTRUCTION` 前，不能只对 scene prompt 特判后绕过全局编译器。

## 数据结构落点

### `storyboards.final_prompt_snapshot`

确认分镜时写入扩展后的 snapshot：

```json
{
  "version": "global_intent_constraints_v1",
  "durationSeconds": 16,
  "globalHardConstraints": [
    "Do not invent garment details not visible in the uploaded assets."
  ],
  "globalUserIntent": {
    "sourcePromptSummary": "高级独立站商品页风格，突出裙摆层次和面料质感。",
    "styleIntent": "premium clean ecommerce product video",
    "sellingPoints": ["emphasize visible skirt silhouette"],
    "negativeIntent": []
  },
  "systemConstraints": [
    "Do not invent clothing details absent from provided assets."
  ],
  "segmentPrompts": [
    {
      "index": 0,
      "durationSeconds": 8,
      "templateId": "front_push_in",
      "prompt": "Slow front-facing push-in shot..."
    }
  ],
  "inputAssets": [
    {
      "assetId": "asset-id",
      "role": "front",
      "sortOrder": 0
    }
  ],
  "assetFactsSnapshot": {
    "hasBack": false,
    "hasDetail": true,
    "hasScene": false
  },
  "templatePolicySnapshot": {
    "selectedTemplateIds": ["front_push_in"],
    "disabledReasons": {
      "back_display": "No back asset is available."
    }
  }
}
```

`systemConstraints` 可暂时保留兼容旧代码，但新逻辑应以 `globalHardConstraints` 为准。后续如要清理旧字段，另开迁移/兼容 SPEC。

### `video_segments.prompt`

继续保存 DeepSeek 原始 `SegmentInstruction`，不要覆盖为编译后的最终 prompt。

原因：

- 后台要能区分 DeepSeek 原始创意和系统最终拼装。
- 重试片段时可以重新编译最新格式，而不污染原始分段 prompt。

### `provider_call_logs.request_snapshot`

每次 `video_generation` 调用必须记录：

```json
{
  "configSource": "env",
  "compiledPromptVersion": "global_intent_constraints_v1",
  "globalHardConstraints": [],
  "globalUserIntent": {},
  "segmentInstruction": "Slow front-facing push-in shot...",
  "compiledPromptSections": [
    "GLOBAL HARD CONSTRAINTS",
    "GLOBAL USER INTENT",
    "SEGMENT INSTRUCTION"
  ],
  "generationProfile": "paid_720p_audio",
  "resolution": "720p",
  "audio": true,
  "watermarkEnabled": false
}
```

不要求在 log 里保存完整 compiled prompt 全文；如果保存，必须确认不会泄露敏感内容。MVP 推荐保存结构化摘要和片段 instruction。

## 流程设计

### 1. 生成分镜前

入口：`POST /api/jobs/[id]/storyboard`

现有输入：

- `selectedTemplateIds`
- `userPrompt`

新增处理：

1. 对 `userPrompt` 做现有 Creem prompt moderation。
2. 从素材分析和模板推荐结果生成 `GlobalHardConstraints`。
3. 从 `userPrompt` 生成 `GlobalUserIntent`。
4. 调用 DeepSeek 时，把 `GlobalHardConstraints`、`GlobalUserIntent`、素材事实、模板定义一并放入用户 prompt。
5. 明确要求 DeepSeek：
   - 只输出每段 `prompt`。
   - 不输出全局约束。
   - 不改写约束。
   - 只能使用 `selectedTemplateIds`。
   - 每段 prompt 必须服从 `GlobalHardConstraints`。

### 2. DeepSeek 输出后

在 `parseStoryboardJson` 通过后增加语义校验或轻量规则校验：

- 无背面图时，任何 segment prompt 不得包含 back view / rear view / turn around / 360 / front-to-back 等意图。
- 无细节图时，不得包含 macro / close-up detail / fabric macro / neckline closeup 等细节特写意图。
- 无 scene 图时，不得要求使用 uploaded scene/background reference。
- segment.templateId 必须来自 selected template IDs。
- segment 数量和时长必须符合 8/16/24 秒要求。

失败策略：

- 首次失败：可重试 DeepSeek 一次，并在重试 prompt 中指出违规原因。
- 第二次仍失败：返回 `storyboard_generation_failed`，不要创建 fake storyboard。
- 不要在系统里盲目删除违规词后继续；如果要做自动修复，必须作为单独小范围规则实现并有测试。

### 3. 用户确认分镜

入口：`POST /api/jobs/[id]/confirm`

确认时：

1. 重新解析 storyboards 中的 `storyboardJson`。
2. 根据当前素材 snapshot 和模板 policy 重新生成 `GlobalHardConstraints`。
3. 根据 storyboard 生成时保存的用户意图摘要或当前可用字段生成 `GlobalUserIntent`。
4. 构建扩展后的 `finalPromptSnapshot`。
5. 用 `finalPromptText(finalPromptSnapshot)` 做最终 prompt moderation。
6. moderation 通过后，创建 `video_segments`。

注意：

- 最终 moderation 文本应覆盖所有 segment instruction、global hard constraints、global user intent。
- 如果 moderation blocked，不得 reserve credits，不得创建 segments。

### 4. 提交视频模型

入口：`submitQueuedSegment`

新增 `compileVideoPromptForSegment`：

```ts
compileVideoPromptForSegment({
  finalPromptSnapshot,
  segment,
  inputAssetSnapshot,
}): {
  prompt: string;
  compiledPromptVersion: "global_intent_constraints_v1";
  globalHardConstraints: string[];
  globalUserIntent: Record<string, unknown>;
  segmentInstruction: string;
}
```

输出 prompt 固定三段：

```text
GLOBAL HARD CONSTRAINTS:
- ...

GLOBAL USER INTENT:
- ...

SEGMENT INSTRUCTION:
...
```

如果 `finalPromptSnapshot` 缺少新字段，必须 fallback：

- `globalHardConstraints` 使用现有 `systemConstraints` 或现场从 asset snapshot 推导。
- `globalUserIntent` 为空。
- `segmentInstruction` 使用 `segment.prompt`。

这样历史任务和管理员重试不会直接坏掉。

### 5. Post-QA

本 SPEC 不要求重写 Post-QA 逻辑，但建议后续让 Post-QA 读取同一套 `globalHardConstraints`，重点检查：

- 是否出现无背面图却展示背面。
- 是否出现无细节图却生成细节特写。
- 是否服装颜色、廓形、可见图案漂移。
- 是否违反用户 negative intent。

如本次实现顺手可做到“在 request snapshot 中保留 constraints 供后续使用”，不要扩大到重写 QA 判定。

## 文件边界

建议新增：

- `src/server/storyboard/global-intent.ts`
  - `buildGlobalUserIntent(input)`
  - `formatGlobalUserIntentForPrompt(intent)`
- `src/server/storyboard/global-constraints.ts`
  - `buildGlobalHardConstraints(input)`
  - `formatGlobalHardConstraintsForPrompt(constraints)`
- `src/server/video/prompt-compiler.ts`
  - `compileVideoPromptForSegment(input)`

建议修改：

- `src/server/storyboard/generate.ts`
  - DeepSeek 输入加入 global constraints / global intent。
  - DeepSeek 输出后增加规则校验。
- `src/server/storyboard/confirm.ts`
  - `buildFinalPromptSnapshot` 扩展字段。
  - `finalPromptText` 纳入三段内容。
- `src/server/video/segments.ts`
  - 提交 provider 时使用 `compileVideoPromptForSegment`。
  - provider call log request snapshot 记录 compiled prompt evidence。
- `src/server/storyboard/confirm.test.ts`
- `src/server/storyboard/generate.test.ts`
- `src/server/video/segments.test.ts`
- 必要时更新 admin/job detail 测试，确保新 snapshot 不破坏展示。

不建议修改：

- 不新增 migration，除非实现时发现当前 JSON snapshot 无法满足。
- 不改 APIMart/EvoLink provider client 的底层 request 行为。
- 不把 compiled prompt 写回 `video_segments.prompt`。

## 测试要求

必须 TDD。先写失败测试，再改实现。

### Storyboard generation tests

新增或更新：

- DeepSeek user prompt 包含 `global_hard_constraints`。
- DeepSeek user prompt 包含 `global_user_intent`。
- DeepSeek user prompt 明确要求只输出 segment prompts，不输出/改写 global constraints。
- 无背面图时，如果 DeepSeek 返回 back view / turn-around / 360，生成失败或触发一次重试。
- 无细节图时，如果 DeepSeek 返回 macro/detail close-up，生成失败或触发一次重试。
- 用户意图里的“突出面料质感”在无细节图时被降级为“visible fabric texture/layering”，而不是 macro detail。

### Storyboard confirmation tests

新增或更新：

- `finalPromptSnapshot` 包含：
  - `version = global_intent_constraints_v1`
  - `globalHardConstraints`
  - `globalUserIntent`
  - `segmentPrompts`
  - `assetFactsSnapshot`
- `finalPromptText` 用于 moderation 时包含三段：
  - `GLOBAL HARD CONSTRAINTS`
  - `GLOBAL USER INTENT`
  - `SEGMENT`
- moderation blocked 时仍不得 reserve credits 或 create video_segments。
- `video_segments.prompt` 保存 DeepSeek 原始 segment prompt，不保存 compiled prompt。

### Video segment submission tests

新增或更新：

- `createVideoGenerationFn` 收到的 `prompt` 包含三段。
- 每个 segment 都带相同 `GLOBAL HARD CONSTRAINTS` 和 `GLOBAL USER INTENT`。
- 不同 segment 的 `SEGMENT INSTRUCTION` 不同。
- scene asset 的图片角色说明被纳入 compiled prompt，且不丢失 global constraints。
- `provider_call_logs.request_snapshot` 包含：
  - `compiledPromptVersion`
  - `globalHardConstraints`
  - `globalUserIntent`
  - `segmentInstruction`
- 老任务缺少新 `finalPromptSnapshot` 字段时 fallback 正常。

## 验收命令

必须运行：

```bash
npm run typecheck
npx vitest run src/server/storyboard/generate.test.ts src/server/storyboard/confirm.test.ts src/server/video/segments.test.ts
npm test
npm run build
```

如果环境具备真实数据库和 provider 凭证，建议补跑：

```bash
npm run smoke:backend -- --job-id <new-paid-job-id>
npm run verify:blockers -- --json
node scripts/job-debug.mjs <new-paid-job-id>
```

真实 smoke 需要确认：

- `provider_call_logs.request_snapshot.compiledPromptVersion = global_intent_constraints_v1`
- `provider_call_logs.request_snapshot.globalHardConstraints` 非空
- `provider_call_logs.request_snapshot.globalUserIntent` 存在
- `video_segments.prompt` 仍是原始 segment instruction
- final video、cover、QA frames 存在
- paid job 仍有 `reserve` / `capture`

## 风险与提醒

- 不要让 DeepSeek 生成全局硬约束。DeepSeek 只能读取和服从。
- 不要直接把用户原文完整追加到每段视频 prompt。要提炼成短摘要，否则容易啰嗦、冲突、泄露敏感内容。
- 不要为了贯彻用户意图违反素材事实。用户想要“背面展示”但没有背面图时，必须禁用或降级，而不是委婉执行。
- 不要把 `video_segments.prompt` 覆盖成 compiled prompt，否则后台无法区分 DeepSeek 原始创意和系统最终约束。
- 不要因为最终视频 prompt 带了硬约束，就省略 DeepSeek 阶段的约束输入。两边都要约束：先约束 DeepSeek，再约束视频模型。
- 当前已有 `VIDEO_GENERATION_DEBUG_RESOLUTION` 能覆盖分辨率；实现真实 smoke 时应确认生产环境未配置 debug override，避免付费 profile 与实际 resolution 不一致。

## 完成定义

本 SPEC 完成时应满足：

- DeepSeek 分镜请求能看到系统生成的 global constraints 和 global user intent。
- DeepSeek 仍只输出每段 segment prompt。
- `finalPromptSnapshot` 保存 global constraints、global user intent、segment prompts 和必要 snapshot。
- 视频模型最终 prompt 固定三段结构。
- 每个片段都收到同一套全局硬约束和用户意图摘要。
- provider call log 能证明 compiled prompt 版本和结构化证据。
- 原有 env-only provider/model 验收不退化。
- 全量测试、typecheck、build 通过。
