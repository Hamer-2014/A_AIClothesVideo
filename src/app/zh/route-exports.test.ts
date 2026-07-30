import { describe, expect, it } from "vitest";

describe("Chinese public route exports", () => {
  it.each([
    ["home", () => import("./page")],
    [
      "three-image landing page",
      () => import("./three-images-to-clothing-video/page"),
    ],
  ])("forwards page metadata for the %s", async (_name, loadRoute) => {
    const route = (await loadRoute()) as Record<string, unknown>;

    expect(route.generateMetadata).toBeTypeOf("function");
  });
});
