import { describe, expect, it } from "vitest";

import {
  WORKSPACE_GUEST_DRAFT_KEY,
  parseWorkspaceGuestDraft,
  serializeWorkspaceGuestDraft,
} from "./guest-draft";

describe("workspace guest draft", () => {
  it("serializes only safe workspace configuration without file blobs", () => {
    const serialized = serializeWorkspaceGuestDraft({
      mode: "trial",
      presetId: "marketplace_clean",
      durationSeconds: 16,
      aspectRatio: "1:1",
      userPrompt: "突出棉麻质感",
      intendedAssetRoles: ["front", "detail"],
      fileNames: ["front.jpg", "detail.png"],
    });

    expect(WORKSPACE_GUEST_DRAFT_KEY).toBe("runwaytools_workspace_guest_draft_v1");
    expect(serialized).toBe(
      JSON.stringify({
        mode: "trial",
        presetId: "marketplace_clean",
        durationSeconds: 16,
        aspectRatio: "1:1",
        userPrompt: "突出棉麻质感",
        intendedAssetRoles: ["front", "detail"],
        fileNames: ["front.jpg", "detail.png"],
      }),
    );
    expect(serialized).not.toContain("blob:");
  });

  it("rejects invalid duration and aspect ratio while normalizing unknown presets", () => {
    const draft = parseWorkspaceGuestDraft(
      JSON.stringify({
        mode: "paid",
        presetId: "unknown_preset",
        durationSeconds: 12,
        aspectRatio: "4:5",
        userPrompt: "keep this",
      }),
    );

    expect(draft).toEqual({
      mode: "paid",
      presetId: "minimal_studio",
      durationSeconds: 8,
      aspectRatio: "9:16",
      userPrompt: "keep this",
      intendedAssetRoles: [],
      fileNames: [],
    });
  });
});
