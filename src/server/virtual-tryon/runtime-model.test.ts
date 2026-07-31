import { describe, expect, it } from "vitest";

import { parseRuntimeModelKeys } from "./runtime";

describe("runtime model snapshot", () => {
  it("requires all three non-empty platform model keys", () => {
    expect(parseRuntimeModelKeys({ front: "model/front.png", side: "model/side.png", back: "model/back.png" })).toEqual({ front: "model/front.png", side: "model/side.png", back: "model/back.png" });
    expect(parseRuntimeModelKeys({ front: "model/front.png", side: "", back: "model/back.png" })).toBeNull();
    expect(parseRuntimeModelKeys({ front: "model/front.png", side: "model/side.png" })).toBeNull();
  });
});
