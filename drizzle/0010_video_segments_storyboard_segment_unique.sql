CREATE UNIQUE INDEX IF NOT EXISTS "video_segments_storyboard_segment_unique"
ON "video_segments" ("storyboard_id", "segment_index")
WHERE "storyboard_id" IS NOT NULL;
