export function userFacingJobMessage(message?: string | null) {
  if (!message) {
    return null;
  }

  if (/\b(EvoLink|APIMart|provider|task polling|status 4\d\d|status 5\d\d)\b/i.test(message)) {
    return "生成服务暂时不可用，请稍后重试。";
  }

  return message;
}
