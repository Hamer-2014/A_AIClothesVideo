export function retryDecision(input: { status?: number; code?: string; attemptCount: number; now: Date }) {
  const retryable = input.code === "timeout" || input.status === 429 || (input.status !== undefined && input.status >= 500);
  if (!retryable || input.attemptCount >= 1) return { retry: false as const, errorCode: input.code ?? "http_" + String(input.status ?? "provider") };
  const delay = 30_000;
  return { retry: true as const, nextRetryAt: new Date(input.now.getTime() + delay) };
}
