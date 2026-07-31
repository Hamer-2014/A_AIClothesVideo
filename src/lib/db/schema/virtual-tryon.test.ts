import { describe, expect, it } from "vitest";

import {
  appearancePackAssets,
  appearancePacks,
  virtualTryonJobs,
} from "./virtual-tryon";

describe("virtual try-on schema", () => {
  it("exports versioned appearance pack tables", () => {
    expect(virtualTryonJobs).toBeDefined();
    expect(appearancePacks).toBeDefined();
    expect(appearancePackAssets).toBeDefined();
  });
});
