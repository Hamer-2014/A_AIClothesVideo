import { describe, expect, it } from "vitest";

import {
  appearancePackAssets,
  appearancePackVideoBridges,
  appearancePacks,
  virtualTryonJobs,
} from "./virtual-tryon";
import { videoJobs } from "./jobs";

describe("virtual try-on schema", () => {
  it("exports versioned appearance pack tables", () => {
    expect(virtualTryonJobs).toBeDefined();
    expect(appearancePacks).toBeDefined();
    expect(appearancePackAssets).toBeDefined();
    expect(appearancePackVideoBridges).toBeDefined();
  });

  it("stores materialization metadata and immutable video provenance", () => {
    expect(appearancePackAssets).toHaveProperty("mimeType");
    expect(appearancePackAssets).toHaveProperty("fileSize");
    expect(appearancePackAssets).toHaveProperty("materializedAssetId");
    expect(appearancePackVideoBridges).toHaveProperty("idempotencyKey");
    expect(appearancePackVideoBridges).toHaveProperty("videoJobId");
    expect(videoJobs).toHaveProperty("generationSourceSnapshot");
  });
});
