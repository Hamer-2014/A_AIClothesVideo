import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { users, verifications, authEmailEvents } from "./auth";
import { assets } from "./assets";
import { adminAuditLogs, abuseEvents } from "./audit";
import { creditLedger, creditWallets, orders } from "./credits";
import { jobStateEvents, videoJobs } from "./jobs";
import { promptModerationResults, providerCallLogs } from "./providers";
import { adminRoles, userProfiles } from "./users";

describe("auth schema compatibility", () => {
  it("stores users.emailVerified as a boolean field for Better Auth", () => {
    expect(users.emailVerified.columnType).toBe("PgBoolean");
  });

  it("uses text-based user ids consistently across auth and business tables", () => {
    expect(users.id.columnType).toBe("PgText");
    expect(authEmailEvents.userId.columnType).toBe("PgText");
    expect(assets.userId.columnType).toBe("PgText");
    expect(abuseEvents.userId.columnType).toBe("PgText");
    expect(adminAuditLogs.adminUserId.columnType).toBe("PgText");
    expect(adminAuditLogs.targetId.columnType).toBe("PgText");
    expect(creditWallets.userId.columnType).toBe("PgText");
    expect(creditLedger.userId.columnType).toBe("PgText");
    expect(orders.userId.columnType).toBe("PgText");
    expect(videoJobs.userId.columnType).toBe("PgText");
    expect(jobStateEvents.actorId.columnType).toBe("PgText");
    expect(providerCallLogs.userId.columnType).toBe("PgText");
    expect(promptModerationResults.userId.columnType).toBe("PgText");
    expect(userProfiles.userId.columnType).toBe("PgText");
    expect(adminRoles.userId.columnType).toBe("PgText");
    expect(adminRoles.grantedBy.columnType).toBe("PgText");
  });

  it("does not define verification ids as uuid-backed columns", () => {
    expect(verifications.id.columnType).not.toBe("PgUUID");
  });

  it("includes follow-up migrations for Better Auth auth-table compatibility", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "drizzle",
      "0002_fix_better_auth_id_columns.sql",
    );
    const idSql = readFileSync(migrationPath, "utf8");

    expect(idSql).toContain('ALTER TABLE "verifications"');
    expect(idSql).toContain('ALTER COLUMN "id" TYPE text USING "id"::text');
    expect(idSql).toContain('ALTER TABLE "users"');
    expect(idSql).toContain('ALTER TABLE "sessions"');
    expect(idSql).toContain('ALTER TABLE "accounts"');

    const emailVerifiedMigrationPath = path.resolve(
      process.cwd(),
      "drizzle",
      "0003_fix_better_auth_email_verified.sql",
    );
    const emailVerifiedSql = readFileSync(emailVerifiedMigrationPath, "utf8");

    expect(emailVerifiedSql).toContain('ALTER TABLE "users"');
    expect(emailVerifiedSql).toContain(
      'ALTER COLUMN "email_verified" TYPE boolean',
    );
    expect(emailVerifiedSql).toContain('USING CASE');

    const userIdMigrationPath = path.resolve(
      process.cwd(),
      "drizzle",
      "0004_fix_user_id_columns_to_text.sql",
    );
    const userIdSql = readFileSync(userIdMigrationPath, "utf8");

    expect(userIdSql).toContain('ALTER TABLE "assets"');
    expect(userIdSql).toContain('ALTER TABLE "credit_wallets"');
    expect(userIdSql).toContain('ALTER TABLE "video_jobs"');
    expect(userIdSql).toContain('ALTER TABLE "user_profiles"');
    expect(userIdSql).toContain('ALTER COLUMN "user_id" TYPE text USING "user_id"::text');

    const auditTargetMigrationPath = path.resolve(
      process.cwd(),
      "drizzle",
      "0014_admin_audit_target_id_text.sql",
    );
    const auditTargetSql = readFileSync(auditTargetMigrationPath, "utf8");

    expect(auditTargetSql).toContain('ALTER TABLE "admin_audit_logs"');
    expect(auditTargetSql).toContain('ALTER COLUMN "target_id" TYPE text');
  });

  it("historical init migration shows why a follow-up fix is required", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "drizzle",
      "0000_init_mvp_schema.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE TABLE "verifications" (');
    expect(sql).toContain('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
    expect(sql).toContain('"email_verified" timestamp with time zone');
  });
});
