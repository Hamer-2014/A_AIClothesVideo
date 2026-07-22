import { describe, expect, it } from "vitest";

import {
  captureProtocols,
  defaultCaptureProtocolId,
  getCaptureProtocol,
  isCaptureProtocolId,
} from "./capture-protocols";

describe("capture protocols", () => {
  it("defines three focused three-image protocols", () => {
    expect(captureProtocols.map((protocol) => protocol.id)).toEqual([
      "product_showcase",
      "product_rotation",
      "model_turn",
    ]);
    expect(captureProtocols.every((protocol) => protocol.slots.length === 3)).toBe(
      true,
    );
  });

  it("uses front back detail for the default product showcase", () => {
    expect(defaultCaptureProtocolId).toBe("product_showcase");
    expect(
      getCaptureProtocol("product_showcase").slots.map((slot) => slot.role),
    ).toEqual(["front", "back", "detail"]);
  });

  it("uses front side back for product and model turns", () => {
    expect(
      getCaptureProtocol("product_rotation").slots.map((slot) => slot.role),
    ).toEqual(["front", "side", "back"]);
    expect(getCaptureProtocol("model_turn").slots.map((slot) => slot.role)).toEqual(
      ["front", "side", "back"],
    );
  });

  it("recognizes valid ids and falls back for unknown values", () => {
    expect(isCaptureProtocolId("model_turn")).toBe(true);
    expect(isCaptureProtocolId("anything_else")).toBe(false);
    expect(getCaptureProtocol("anything_else").id).toBe(defaultCaptureProtocolId);
  });
});
