import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("job detail page server imports", () => {
  it("does not import client-only job progress helpers into the server page", () => {
    const source = readFileSync(
      "src/app/(dashboard)/jobs/[id]/page.tsx",
      "utf8",
    );

    expect(source).not.toContain(
      'import { userFacingJobMessage } from "@/components/jobs/job-progress"',
    );
    expect(source).toContain(
      'import { userFacingJobMessage } from "@/lib/jobs/user-facing-message"',
    );
  });

  it("presents storyboard as a readable summary instead of raw JSON", () => {
    const source = readFileSync(
      "src/app/(dashboard)/jobs/[id]/page.tsx",
      "utf8",
    );

    expect(source).toContain("分镜摘要");
    expect(source).toContain("storyboardSegments");
    expect(source).not.toContain(
      "JSON.stringify(detail.latestStoryboard.storyboardJson, null, 2)",
    );
  });
});
