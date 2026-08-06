# Homepage Promo Video Quality Remediation

**Goal:** 撤下不合格的 24 秒首页样片，补齐多段成片的拼接边界、冻结和画幅/分辨率质量门禁，并为重新生成合格的 9:16 宣传素材建立可验证流程。

**Risk:** 中高。涉及首页公开展示、Cloud Run worker 技术质检和主应用到 worker 的共享 payload；外部重新生成会消耗点数。

## 交付物

1. 首页与案例目录恢复到已验证的旧样片，不再宣称当前不合格视频为 24 秒虚拟试穿成片。
2. Standard/Strict 多段视频在原有均匀抽帧之外，额外抽取每个 8 秒拼接边界帧；Lite 保持原策略。
3. Stitch worker 在上传前检测至少 1 秒的冻结，并对期望画幅和最低分辨率执行技术门禁。
4. 主应用将视频规格中的画幅与最低分辨率通过 stitch payload 传给 worker，旧 payload 保持可解析。
5. 定妆图规范为真正 9:16，按分镜视角使用素材；确认供应商高清参数后再生成，禁止仅放大低清视频冒充高清。
6. 合格 24 秒完整版用于案例页，并从中制作 8-12 秒首页精选短版。

## 实施顺序

1. TDD 回退首页和案例目录样片引用及相关文案。
2. TDD 扩展 QA frame plan，覆盖 16/24/32 秒拼接边界。
3. TDD 增加 ffprobe 画幅/分辨率检查和 FFmpeg `freezedetect` 冻结检查，并接入 stitch 上传前流程。
4. TDD 扩展 Next.js -> Cloud Run payload 契约和部署文档。
5. 规范化三张定妆图并视觉核验，确认 APIMart 当前高清参数后再走真实工作流重生成。
6. 对新成片执行分辨率、比例、冻结、边界和人工视觉验收；产出首页短版与案例页完整版。

## 验收

```powershell
pnpm exec vitest run src/app/page.test.tsx src/lib/demo-cases/catalog.test.ts src/components/public/demo-case-list.test.tsx src/components/public/sample-video.test.tsx --reporter=dot
pnpm exec vitest run workers/stitch-worker/src/qa-frame-plan.test.ts workers/stitch-worker/src/ffmpeg.test.ts workers/stitch-worker/src/payload.test.ts workers/stitch-worker/src/stitch.test.ts src/server/stitch/jobs.test.ts src/server/stitch/trigger-cloud-run.test.ts --reporter=dot
pnpm typecheck
pnpm lint
pnpm build
pnpm exec vitest run --shard=1/4 --reporter=dot
pnpm exec vitest run --shard=2/4 --reporter=dot
pnpm exec vitest run --shard=3/4 --reporter=dot
pnpm exec vitest run --shard=4/4 --reporter=dot
git diff --check
```

最后在桌面与移动视口复验首页和案例页，确认媒体无溢出、无错误宣传声明，且首页只使用通过质量门禁的短版。
