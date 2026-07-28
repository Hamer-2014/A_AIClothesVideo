import { describe, expect, it } from "vitest";

import { metadata } from "./layout";

describe("root metadata", () => {
  it("uses the AI Clothes Video product identity", () => {
    expect(metadata.title).toBe("AI Clothes Video");
    expect(metadata.description).toBe(
      "上传 3 张服装图，生成可发布的商品宣传视频。",
    );
    const icons = JSON.stringify(metadata.icons);
    expect(icons).toContain("/icon.svg?v=4");
    expect(icons).not.toContain("/icon.svg?v=3");
    expect(icons).toContain("image/svg+xml");
    expect(icons).not.toContain("/favicon.ico");
    expect(icons).not.toContain("/brand/logo.png");
  });
});
