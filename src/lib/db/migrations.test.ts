import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface MigrationJournal {
  entries: Array<{ tag: string }>;
}

describe("drizzle migrations", () => {
  it("registers every SQL migration in the journal", () => {
    const drizzleDir = path.resolve(process.cwd(), "drizzle");
    const migrationFiles = readdirSync(drizzleDir)
      .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
      .map((fileName) => fileName.replace(/\.sql$/, ""))
      .sort();
    const journalPath = path.join(drizzleDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;
    const journalTags = journal.entries.map((entry) => entry.tag).sort();

    expect(journalTags).toEqual(migrationFiles);
  });

  it("includes the funnel events migration with required fields", () => {
    const drizzleDir = path.resolve(process.cwd(), "drizzle");
    const journalPath = path.join(drizzleDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;

    expect(journal.entries.some((entry) => entry.tag === "0012_funnel_events")).toBe(true);

    const migrationSql = readFileSync(
      path.join(drizzleDir, "0012_funnel_events.sql"),
      "utf8",
    );

    expect(migrationSql).toContain('"funnel_events"');
    expect(migrationSql).toContain('"event_name"');
    expect(migrationSql).toContain('"metadata"');
    expect(migrationSql).toContain('"created_at"');
  });

  it("includes the admin job notes migration with required fields", () => {
    const drizzleDir = path.resolve(process.cwd(), "drizzle");
    const journalPath = path.join(drizzleDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;

    expect(journal.entries.some((entry) => entry.tag === "0013_admin_job_notes")).toBe(
      true,
    );

    const migrationSql = readFileSync(
      path.join(drizzleDir, "0013_admin_job_notes.sql"),
      "utf8",
    );

    expect(migrationSql).toContain('"admin_job_notes"');
    expect(migrationSql).toContain('"job_id"');
    expect(migrationSql).toContain('"admin_user_id"');
    expect(migrationSql).toContain('"note"');
    expect(migrationSql).toContain('"created_at"');
  });
});
