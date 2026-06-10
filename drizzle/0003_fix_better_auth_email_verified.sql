ALTER TABLE "users"
ALTER COLUMN "email_verified" DROP DEFAULT;

ALTER TABLE "users"
ALTER COLUMN "email_verified" TYPE boolean
USING CASE
  WHEN "email_verified" IS NULL THEN false
  ELSE true
END;

ALTER TABLE "users"
ALTER COLUMN "email_verified" SET DEFAULT false;

UPDATE "users"
SET "email_verified" = false
WHERE "email_verified" IS NULL;

ALTER TABLE "users"
ALTER COLUMN "email_verified" SET NOT NULL;
