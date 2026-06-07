import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("better-auth route", () => {
  it("exports GET and POST handlers", () => {
    expect(GET).toEqual(expect.any(Function));
    expect(POST).toEqual(expect.any(Function));
  });
});
