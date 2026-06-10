ALTER TABLE "accounts"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE text USING "id"::text;
--> statement-breakpoint
ALTER TABLE "sessions"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE text USING "id"::text;
--> statement-breakpoint
ALTER TABLE "users"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE text USING "id"::text;
--> statement-breakpoint
ALTER TABLE "verifications"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE text USING "id"::text;
