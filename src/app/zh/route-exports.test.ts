import { describe, expect, it } from "vitest";

import * as homeRoute from "./page";
import * as examplesRoute from "./examples/page";
import * as guidesRoute from "./guides/page";
import * as guideArticleRoute from "./guides/[slug]/page";
import * as threeImageRoute from "./three-images-to-clothing-video/page";

describe("Chinese public route exports", () => {
  it.each([
    ["home", homeRoute],
    ["examples landing page", examplesRoute],
    ["guides index", guidesRoute],
    ["guide article", guideArticleRoute],
    ["three-image landing page", threeImageRoute],
  ])("forwards page metadata for the %s", (_name, route) => {
    expect(route.generateMetadata).toBeTypeOf("function");
  });
});
