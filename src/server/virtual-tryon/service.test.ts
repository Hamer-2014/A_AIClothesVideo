import { describe, expect, it, vi } from "vitest";

import { finalizeAppearancePack } from "./service";

describe("appearance pack finalization", () => {
  it("captures only after every required view and strict QA pass", async () => {
    const capture = vi.fn().mockResolvedValue(undefined);
    const result = await finalizeAppearancePack({ jobId: "job", packId: "pack", mode: "three_view", r2Keys: { front: "f", side: "s", back: "b" }, viewPasses: [true, true, true], crossViewPass: true }, { capture });
    expect(capture).toHaveBeenCalledWith({ idempotencyKey: "virtual-tryon:job:capture" });
    expect(result.videoGeneration).toBe("not_enabled");
  });

  it("fails closed without a required view", async () => {
    await expect(finalizeAppearancePack({ jobId: "job", packId: "pack", mode: "three_view", r2Keys: { front: "f", side: "s" }, viewPasses: [true, true], crossViewPass: true }, { capture: vi.fn() })).rejects.toThrow("strict_qa_not_passed");
  });
});
