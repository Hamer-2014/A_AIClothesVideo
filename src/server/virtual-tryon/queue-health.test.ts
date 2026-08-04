import { describe, expect, it } from "vitest";

import { classifyVirtualTryOnQueueHealth } from "./queue-health";

describe("virtual try-on queue health", () => {
  const now = new Date("2026-08-04T14:00:00.000Z");

  it("marks only an old unclaimed queued job as delayed", () => {
    expect(classifyVirtualTryOnQueueHealth({
      status: "queued",
      attemptCount: 0,
      updatedAt: new Date("2026-08-04T13:57:59.000Z"),
      now,
    })).toBe("delayed");

    expect(classifyVirtualTryOnQueueHealth({
      status: "queued",
      attemptCount: 0,
      updatedAt: new Date("2026-08-04T13:59:00.000Z"),
      now,
    })).toBe("normal");
    expect(classifyVirtualTryOnQueueHealth({
      status: "queued",
      attemptCount: 1,
      updatedAt: new Date("2026-08-04T13:50:00.000Z"),
      now,
    })).toBe("normal");
    expect(classifyVirtualTryOnQueueHealth({
      status: "generating",
      attemptCount: 0,
      updatedAt: new Date("2026-08-04T13:50:00.000Z"),
      now,
    })).toBe("normal");
  });
});
