export function retryDecision(input: { status?: number; code?: string; attemptCount: number; now: Date }) {
  const statusFromCode = input.code?.match(/^http_(\d{3})$/)?.[1];
  const status = input.status ?? (statusFromCode ? Number(statusFromCode) : undefined);
  const retryable = input.code === "timeout" || input.code === "network_error" || status === 429 || (status !== undefined && status >= 500);
  if (!retryable || input.attemptCount >= 1) return { retry: false as const, errorCode: input.code ?? "http_" + String(status ?? "provider") };
  const delay = 30_000;
  return { retry: true as const, nextRetryAt: new Date(input.now.getTime() + delay) };
}
