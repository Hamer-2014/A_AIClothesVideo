ALTER TABLE "video_jobs"
ADD COLUMN IF NOT EXISTS "preset_id" text,
ADD COLUMN IF NOT EXISTS "preset_snapshot" jsonb;

ALTER TABLE "storyboards"
ADD COLUMN IF NOT EXISTS "preset_id" text,
ADD COLUMN IF NOT EXISTS "preset_snapshot" jsonb;
