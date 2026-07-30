import { describe, expect, it } from "vitest";

import { buildRootMetadata } from "./layout";

describe("root metadata", () => {
  it("uses English product metadata by default", () => {
    const metadata = buildRootMetadata("en");

    expect(metadata.title).toBe("AI Clothes Video");
    expect(metadata.description).toBe(
      "Upload three clothing images to create a product marketing video.",
    );
    const icons = JSON.stringify(metadata.icons);
    expect(icons).toContain("/icon.svg?v=4");
    expect(icons).not.toContain("/icon.svg?v=3");
    expect(icons).toContain("image/svg+xml");
    expect(icons).not.toContain("/favicon.ico");
    expect(icons).not.toContain("/brand/logo.png");
  });

  it("provides Chinese metadata for Chinese URLs", () => {
    const metadata = buildRootMetadata("zh-CN");

    expect(metadata.title).toBe("AI Clothes Video");
    expect(metadata.description).toBe(
      "上传 3 张服装图，生成可发布的商品宣传视频。",
    );
  });
});
