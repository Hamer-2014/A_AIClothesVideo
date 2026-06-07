# DeepSeek 分镜 API Implementation Plan

**Goal:** 实现模板选择后的 storyboard draft API，保证 moderation、模板可用性和 provider 调用审计完整。

**Architecture:** DeepSeek client 只负责 provider 调用；schema 只负责 JSON 校验；generate service 负责业务编排；route 负责鉴权和错误映射。

---

### Task 1: DeepSeek Client

**Files:**
- Create: `src/lib/providers/deepseek/client.ts`
- Create: `src/lib/providers/deepseek/client.test.ts`

- [x] 读取 `DEEPSEEK_API_KEY`。
- [x] 默认 base URL 使用 `https://api.deepseek.com`。
- [x] 默认 storyboard model 使用 `deepseek-v4-flash`。
- [x] 调用 `/chat/completions` 并要求 JSON object。
- [x] provider 错误不伪造成功。

### Task 2: Storyboard Schema

**Files:**
- Create: `src/server/storyboard/schema.ts`
- Create: `src/server/storyboard/schema.test.ts`

- [x] 校验 8/16/24 秒 segment 数量。
- [x] 每个 segment 必须为 8 秒。
- [x] 拒绝不可用或伪造模板 ID。

### Task 3: Generate Service

**Files:**
- Create: `src/server/storyboard/generate.ts`
- Create: `src/server/storyboard/generate.test.ts`

- [x] 校验 selected templates 属于当前 job 可用模板。
- [x] 用户 prompt 先过 Creem moderation。
- [x] moderation block 时不调用 DeepSeek。
- [x] DeepSeek 成功调用写 `provider_call_logs`。
- [x] 保存 draft storyboard。
- [x] job 状态进入 `storyboard_draft_ready`。
- [x] provider 成功后 DB 失败不伪造 DeepSeek failed。

### Task 4: Route

**Files:**
- Create: `src/app/api/jobs/[id]/storyboard/route.ts`
- Create: `src/app/api/jobs/[id]/storyboard/route.test.ts`
- Update: `src/app/api/jobs/[id]/route.ts`
- Update: `src/server/jobs/get-job.ts`

- [x] 登录用户可生成自己 job 的 storyboard。
- [x] API 返回 draft segments。
- [x] job detail 返回 latest storyboard。

### Task 5: Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
