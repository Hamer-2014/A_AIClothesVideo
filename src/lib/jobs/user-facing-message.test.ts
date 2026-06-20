import { describe, expect, it } from "vitest";

import { userFacingJobMessage } from "./user-facing-message";

describe("userFacingJobMessage", () => {
  it("maps provider errors to service-busy copy", () => {
    expect(userFacingJobMessage("APIMart provider status 500")).toBe(
      "生成服务暂时繁忙，本次没有交付成片。冻结点数会自动退回，你可以稍后重试。",
    );
  });

  it("maps moderation errors to prompt revision copy", () => {
    expect(userFacingJobMessage("prompt_moderation_blocked policy denied")).toBe(
      "当前描述无法用于生成，请修改场景或文案后重试。",
    );
  });

  it("maps asset analysis errors to upload guidance copy", () => {
    expect(userFacingJobMessage("asset analysis failed: low quality image")).toBe(
      "素材检查未通过。建议上传更清晰的正面图后重试。",
    );
  });

  it("maps post QA errors to quality failure copy", () => {
    expect(userFacingJobMessage("post_qa_failed abnormal frame")).toBe(
      "成片质量未通过检查，本次不会扣点。你可以更换素材或选择更稳妥的镜头后重试。",
    );
  });

  it("maps credits errors to billing copy", () => {
    expect(userFacingJobMessage("credits balance insufficient")).toBe(
      "点数不足，请充值后继续生成。",
    );
  });

  it("falls back to safe generic copy", () => {
    expect(userFacingJobMessage("unexpected internal error")).toBe(
      "任务未能完成。本次未交付成片时不会正式扣点，你可以稍后重试。",
    );
  });

  it("returns null when there is no message", () => {
    expect(userFacingJobMessage(null)).toBeNull();
  });
});
