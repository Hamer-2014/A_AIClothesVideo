export function userFacingJobMessage(message?: string | null) {
  if (!message) {
    return null;
  }

  if (
    /\b(EvoLink|APIMart|provider|task polling|timeout|timed out|status 4\d\d|status 5\d\d)\b/i.test(
      message,
    )
  ) {
    return "生成服务暂时繁忙，本次没有交付成片。冻结点数会自动退回，你可以稍后重试。";
  }

  if (/\b(moderation|prompt_moderation|policy|blocked|denied)\b/i.test(message)) {
    return "当前描述无法用于生成，请修改场景或文案后重试。";
  }

  if (/\b(asset|image|analysis|low quality|blur|occlusion|素材)\b/i.test(message)) {
    return "素材检查未通过。建议上传更清晰的正面图后重试。";
  }

  if (/\b(post_qa|quality|frame|abnormal|质检)\b/i.test(message)) {
    return "成片质量未通过检查，本次不会扣点。你可以更换素材或选择更稳妥的镜头后重试。";
  }

  if (/\b(credit|credits|balance|insufficient|点数|余额)\b/i.test(message)) {
    return "点数不足，请充值后继续生成。";
  }

  return "任务未能完成。本次未交付成片时不会正式扣点，你可以稍后重试。";
}
