import { describe, expect, it } from "vitest";

import {
  COMPILED_PROMPT_VERSION,
  compileVideoPromptForSegment,
} from "./prompt-compiler";

describe("compileVideoPromptForSegment", () => {
  it("builds the fixed three-section prompt from global constraints, user intent, and segment instruction", () => {
    const result = compileVideoPromptForSegment({
      finalPromptSnapshot: {
        globalHardConstraints: [
          "Do not invent garment details not visible in the uploaded assets.",
          "Keep garment color and silhouette consistent.",
        ],
        globalUserIntent: {
          styleIntent: "premium clean ecommerce product video",
          sellingPoints: [
            "emphasize visible skirt silhouette",
            "show visible fabric layering",
          ],
          negativeIntent: ["avoid runway-walk presentation"],
        },
      },
      segment: {
        prompt:
          "  Slow front-facing push-in shot of the garment, keeping the silhouette centered.  ",
      },
    });

    expect(result.compiledPromptVersion).toBe(COMPILED_PROMPT_VERSION);
    expect(result.compiledPromptSections).toEqual([
      "GLOBAL HARD CONSTRAINTS",
      "GLOBAL USER INTENT",
      "SEGMENT INSTRUCTION",
    ]);
    expect(result.globalHardConstraints).toEqual([
      "Do not invent garment details not visible in the uploaded assets.",
      "Keep garment color and silhouette consistent.",
    ]);
    expect(result.globalUserIntent).toEqual({
      styleIntent: "premium clean ecommerce product video",
      sellingPoints: [
        "emphasize visible skirt silhouette",
        "show visible fabric layering",
      ],
      negativeIntent: ["avoid runway-walk presentation"],
    });
    expect(result.globalUserIntentLines).toEqual([
      "Premium clean ecommerce product video.",
      "Emphasize visible skirt silhouette.",
      "Show visible fabric layering.",
      "Avoid runway-walk presentation.",
    ]);
    expect(result.segmentInstruction).toBe(
      "Slow front-facing push-in shot of the garment, keeping the silhouette centered.",
    );
    expect(result.prompt).toBe(
      [
        "GLOBAL HARD CONSTRAINTS:",
        "- Do not invent garment details not visible in the uploaded assets.",
        "- Keep garment color and silhouette consistent.",
        "",
        "GLOBAL USER INTENT:",
        "- Premium clean ecommerce product video.",
        "- Emphasize visible skirt silhouette.",
        "- Show visible fabric layering.",
        "- Avoid runway-walk presentation.",
        "",
        "SEGMENT INSTRUCTION:",
        "Slow front-facing push-in shot of the garment, keeping the silhouette centered.",
      ].join("\n"),
    );
  });

  it("keeps different segment instructions different while reusing global sections", () => {
    const finalPromptSnapshot = {
      globalHardConstraints: [
        "Do not invent garment details not visible in the uploaded assets.",
      ],
      globalUserIntent: {
        styleIntent: "clean ecommerce product video",
      },
    };

    const first = compileVideoPromptForSegment({
      finalPromptSnapshot,
      segment: { prompt: "Slow front push-in." },
    });
    const second = compileVideoPromptForSegment({
      finalPromptSnapshot,
      segment: { prompt: "Stable side-lit texture reveal." },
    });

    expect(first.segmentInstruction).toBe("Slow front push-in.");
    expect(second.segmentInstruction).toBe("Stable side-lit texture reveal.");
    expect(first.globalHardConstraints).toEqual(second.globalHardConstraints);
    expect(first.globalUserIntentLines).toEqual(second.globalUserIntentLines);
  });

  it("falls back to system constraints and default user intent for old snapshots", () => {
    const result = compileVideoPromptForSegment({
      finalPromptSnapshot: {
        systemConstraints: ["Keep visible garment facts consistent."],
      },
      segment: { prompt: "Front product shot." },
    });

    expect(result.globalHardConstraints).toEqual([
      "Keep visible garment facts consistent.",
    ]);
    expect(result.globalUserIntent).toBeNull();
    expect(result.globalUserIntentLines).toEqual([
      "Clean ecommerce product video.",
    ]);
    expect(result.prompt).toContain("GLOBAL USER INTENT:\n- Clean ecommerce product video.");
  });

  it("uses the default anti-invention constraint when no snapshot constraints exist", () => {
    const result = compileVideoPromptForSegment({
      segment: { prompt: "Front product shot." },
    });

    expect(result.globalHardConstraints).toEqual([
      "Do not invent garment details not visible in the uploaded assets.",
    ]);
  });

  it("derives hard-constraint fallback from asset roles for old segment snapshots", () => {
    const result = compileVideoPromptForSegment({
      inputAssetSnapshot: {
        assets: [{ assetId: "front-asset", role: "front", sortOrder: 0 }],
      },
      segment: { prompt: "Front product shot." },
    });

    expect(result.globalHardConstraints).toEqual(
      expect.arrayContaining([
        "Do not invent garment details not visible in the uploaded assets.",
        "Do not show the back side because no back asset is available.",
        "Do not use macro shots or detail close-up shots because no detail asset is available.",
      ]),
    );
  });

  it("keeps image role numbering in the provided asset order", () => {
    const result = compileVideoPromptForSegment({
      inputAssetSnapshot: {
        assets: [
          { assetId: "scene-asset", role: "scene", sortOrder: 10 },
          { assetId: "front-asset", role: "front", sortOrder: 0 },
        ],
      },
      segment: { prompt: "Scene-led product shot." },
    });

    expect(result.globalHardConstraints).toEqual(
      expect.arrayContaining([
        "Image 1 is a scene/background reference.",
        "Image 2 is a front garment reference.",
      ]),
    );
  });

  it("adds scene reference role constraints without dropping existing global constraints", () => {
    const result = compileVideoPromptForSegment({
      finalPromptSnapshot: {
        globalHardConstraints: [
          "Do not invent garment details not visible in the uploaded assets.",
        ],
        globalUserIntent: {
          styleIntent: "editorial but accurate ecommerce video",
        },
      },
      inputAssetSnapshot: {
        assets: [
          { assetId: "front-asset", role: "front", sortOrder: 0 },
          { assetId: "scene-asset", role: "scene", sortOrder: 1 },
        ],
      },
      segment: {
        prompt: "Front garment reveal in the referenced environment.",
      },
    });

    expect(result.globalHardConstraints).toEqual([
      "Do not invent garment details not visible in the uploaded assets.",
      "Image 1 is a front garment reference.",
      "Image 2 is a scene/background reference.",
      "Use scene/background reference only for environment, lighting, and mood.",
      "Do not copy people, faces, logos, storefront names, or readable text from the scene/background reference.",
    ]);
    expect(result.prompt).toContain(
      "- Use scene/background reference only for environment, lighting, and mood.",
    );
    expect(result.prompt).toMatch(
      /^GLOBAL HARD CONSTRAINTS:[\s\S]+GLOBAL USER INTENT:[\s\S]+SEGMENT INSTRUCTION:[\s\S]+$/,
    );
  });

  it("reads segment-level input asset snapshots for request snapshot evidence", () => {
    const result = compileVideoPromptForSegment({
      finalPromptSnapshot: {
        globalHardConstraints: [
          "Do not invent garment details not visible in the uploaded assets.",
        ],
        globalUserIntent: {
          sellingPoints: ["highlight visible pleats"],
        },
      },
      segment: {
        prompt: "Pleat-focused front shot.",
        segmentIndex: 1,
        templateId: "front_detail_motion",
        inputAssetSnapshot: {
          assets: [{ assetId: "scene-asset", role: "scene", sortOrder: 0 }],
        },
      },
    });

    expect(result).toMatchObject({
      compiledPromptVersion: COMPILED_PROMPT_VERSION,
      globalHardConstraints: expect.arrayContaining([
        "Do not invent garment details not visible in the uploaded assets.",
        "Use scene/background reference only for environment, lighting, and mood.",
      ]),
      globalUserIntent: {
        sellingPoints: ["highlight visible pleats"],
      },
      globalUserIntentLines: ["Highlight visible pleats."],
      segmentInstruction: "Pleat-focused front shot.",
      compiledPromptSections: [
        "GLOBAL HARD CONSTRAINTS",
        "GLOBAL USER INTENT",
        "SEGMENT INSTRUCTION",
      ],
    });
  });
});
