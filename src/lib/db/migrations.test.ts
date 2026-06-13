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
});
