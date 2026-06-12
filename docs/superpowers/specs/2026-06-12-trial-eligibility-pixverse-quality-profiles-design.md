# Trial Eligibility And PixVerse Quality Profiles Design

## Goal

Fix the current overly broad trial behavior and introduce explicit APIMart PixVerse quality profiles:

- Free trial is no longer "every 8-second job is free".
- The server decides whether a job is a free trial or paid.
- Trial output uses APIMart PixVerse V6 at `540p`, watermarked, without audio.
- Paid output starts with `720p + audio`.
- `1080p + audio` is kept as a future paid high-quality profile, not the default.
- User access IP is recorded in plain text for abuse review and operations.

## Current Problem

The current frontend treats `durationSeconds === 8` as trial and sends `isTrial=true`.
The backend also accepts `isTrial` from client input when creating jobs.

This is unsafe because the client is effectively deciding whether a job is free. It also blocks a normal paid 8-second SKU: after the trial is used, 8-second jobs should cost 70 credits.

There is a second mismatch: APIMart PixVerse submission is currently hard-coded to `540p` and does not pass an `audio` parameter. The product now needs different generation parameters for trial and paid jobs.

## Product Rules

### Trial Eligibility

- Trial is limited to one 8-second job per user per rolling 24-hour window.
- Trial requires the user to be logged in.
- Trial should require verified email when the auth layer exposes a reliable verified-email signal.
- Trial only applies to 8-second jobs.
- Trial only allows low-risk templates where `isTrialAllowed = true`.
- Trial jobs cost 0 credits.
- Trial jobs do not reserve or capture credits.
- Trial jobs use lite Post-QA.
- Trial jobs are watermarked.
- Trial jobs use APIMart PixVerse V6 with:
  - `resolution = 540p`
  - `audio = false`

### Paid Generation

- Paid 8-second jobs cost 70 credits.
- Paid 16-second jobs cost 130 credits.
- Paid 24-second jobs cost 190 credits.
- Paid jobs reserve credits after prompt moderation and capture only after Post-QA passes.
- Paid jobs use APIMart PixVerse V6 with:
  - `resolution = 720p`
  - `audio = true`
- `1080p + audio` must not be enabled for normal users in this change. It can be introduced later as a separate higher-priced profile after real APIMart cost and failure-rate data exist.

## Data Model

Add an explicit billing/generation profile instead of deriving trial from duration or credit cost.

### `video_jobs`

Add:

- `billing_mode`: text or enum, values:
  - `free_trial`
  - `paid`
- `generation_profile`: text or enum, values:
  - `trial_540p_watermarked`
  - `paid_720p_audio`
  - future: `paid_1080p_audio`
- `watermark_enabled`: boolean
- `trial_eligibility_snapshot`: JSON, nullable

The snapshot should include the decision inputs used at creation time:

```json
{
  "decision": "granted",
  "window": "rolling_24h",
  "previousTrialCount": 0,
  "checkedAt": "2026-06-12T00:00:00.000Z"
}
```

### `video_segments`

Add segment-level generation settings, because provider submission happens per segment:

- `generation_profile`
- `resolution`
- `audio_enabled`
- `watermark_enabled`

These values should be copied from the job/profile when segments are created. Segment-level fields make provider requests auditable even if job-level defaults change later.

### `free_trial_usages`

Add a table to make eligibility explicit:

- `id`
- `user_id`
- `video_job_id`
- `used_at`
- `duration_seconds`
- `generation_profile`
- `resolution`
- `watermark_enabled`
- `provider`
- `model`
- `created_at`
- `updated_at`

Eligibility query:

```text
No free_trial_usages row for the same user_id where used_at >= now - 24 hours.
```

The row should be created transactionally with the trial job, or at the latest before the job enters generation, so repeated requests cannot race into multiple free trials.

### `user_access_events`

Add a lightweight user access log table:

- `id`
- `user_id`, nullable for unauthenticated events
- `event_type`, for example:
  - `job_create`
  - `trial_eligibility_check`
  - `trial_granted`
  - `trial_denied`
  - `checkout_start`
- `ip_address`, plain text
- `user_agent`
- `path`
- `metadata`
- `created_at`

Plain text IP is allowed for this product decision, but it is personal data. Access must be limited to admin/operator views, and the UI should present it as operational/security evidence, not general analytics.

Initial retention target: 90 days for `user_access_events`. Do not implement automatic deletion in this change unless it is cheap, but document the retention policy and keep the table isolated so cleanup can be added later.

## Server-Side Flow

### Create Job

The create job API should no longer trust client-provided `isTrial`.

Input should include:

- `assetIds`
- `durationSeconds`
- `aspectRatio`
- optional client preference such as `useFreeTrialIfAvailable`

The server computes:

1. Is duration 8 seconds?
2. Has the user used a free trial within the last 24 hours?
3. Is the request eligible for trial?
4. If eligible and the client prefers trial, set:
   - `billing_mode = free_trial`
   - `credit_cost = 0`
   - `generation_profile = trial_540p_watermarked`
   - `watermark_enabled = true`
   - `post_qa_mode = lite`
5. Otherwise set:
   - `billing_mode = paid`
   - `credit_cost = 70/130/190`
   - `generation_profile = paid_720p_audio`
   - `watermark_enabled = false`
   - `post_qa_mode = standard`

If `useFreeTrialIfAvailable` is omitted, use the product default:

- For 8-second jobs, use trial if available.
- For 16/24-second jobs, always paid.

### Template And Storyboard

Trial status must come from `video_jobs.billing_mode`, not from request query params.

Trial jobs:

- only recommend/allow low-risk trial templates.
- fail confirmation if selected templates are no longer trial-eligible.

Paid jobs:

- allow normal paid template rules.

### Confirm Storyboard

Before creating segments:

- Re-check trial eligibility if `billing_mode = free_trial`.
- If the trial was consumed by another job during the gap, convert the job to paid only if the UI explicitly supports that transition. Otherwise return a clear error and ask the user to restart as paid.
- Create segment rows with copied generation settings.

Paid jobs reserve credits after Creem prompt moderation passes.
Trial jobs skip credit reserve.

### Submit Segment

Extend video generation input with:

- `resolution`
- `audio`
- `watermarkEnabled`
- `generationProfile`

For APIMart PixVerse V6 request body:

```json
{
  "model": "pixverse-v6",
  "prompt": "...",
  "duration": 8,
  "resolution": "540p or 720p",
  "audio": true,
  "size": "9:16"
}
```

APIMart does not create the product watermark by itself unless their API exposes a verified watermark parameter. If no provider-level watermark exists, watermarking must be done in the stitch/processing stage or by a separate post-process step before delivery.

### Cost Logging

Provider cost must stop being recorded as zero when APIMart returns cost data.

When polling APIMart tasks, parse known cost fields such as:

- `data.cost`
- `cost`
- `usage.cost`

Write the value to:

- `provider_call_logs.cost_estimate`
- `video_segments.cost_estimate`

The implementation should tolerate missing cost fields, but missing cost must be visible in admin job detail as unknown rather than silently implying zero.

## Access IP Recording

Record plain text IP for job and trial-related operations.

Use the same extraction order as admin audit logs:

1. first value from `x-forwarded-for`
2. `x-real-ip`
3. null if absent

Record at least:

- job create
- trial eligibility check
- trial grant
- trial deny
- checkout start

This is not a hard anti-abuse gate for MVP. The first version records evidence and allows admins to review suspicious patterns. Do not block multi-email behavior in this change.

## API/UI Behavior

### Workspace

The UI should no longer present 8 seconds as always free.

Expected states:

- Trial available: 8-second option shows free trial messaging.
- Trial unavailable: 8-second option shows 70 credits.
- 16/24-second options always show paid credits.

The UI should not send `isTrial`.

### Job Detail

Show:

- billing mode
- credit cost
- generation profile
- resolution
- audio enabled
- watermark enabled

### Admin

Admin job detail should show segment-level:

- provider/model
- resolution
- audio enabled
- watermark enabled
- generation profile
- cost estimate

Admin user or abuse view can later aggregate access events by IP address. This change only requires storage and minimal admin visibility if there is already a natural place to show it.

## Error Handling

- If trial eligibility cannot be checked because the database is unavailable, fail closed for free trial and return a retryable error. Do not silently create a paid job unless the user explicitly chose paid.
- If APIMart rejects `audio` or a resolution, surface provider failure and release credits for paid jobs through the existing failure path.
- If watermark processing fails for a trial job, the job must not become deliverable without a watermark.

## Tests

Required coverage:

- Creating an 8-second job with no recent trial creates `free_trial`, `credit_cost = 0`, `trial_540p_watermarked`.
- Creating an 8-second job when a trial exists within 24 hours creates paid job with `credit_cost = 70`.
- Creating 16/24-second jobs is always paid.
- Client-provided `isTrial=true` cannot force a free trial.
- Trial confirmation rejects non-trial-eligible templates.
- Trial segment creation copies `540p`, `audio=false`, `watermark=true`.
- Paid segment creation copies `720p`, `audio=true`, `watermark=false`.
- APIMart request body includes `resolution` and `audio`.
- APIMart cost from poll response is stored when present.
- User access event records plain text IP and user agent for job create/trial events.

## Non-Goals

- Do not implement multi-email blocking.
- Do not add device fingerprinting.
- Do not require phone verification.
- Do not open `1080p + audio` to normal users.
- Do not build a full fraud dashboard in this change.
- Do not rely on frontend logic for billing decisions.

## Open Decisions

No blocking open decisions. The current product decision is:

- Trial: rolling 24-hour per-user 8-second free trial, `540p`, watermarked, no audio.
- Paid: `720p + audio`.
- Plain text IP recording is accepted for MVP operational review.
