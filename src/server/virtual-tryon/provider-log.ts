import type { AppearanceView } from "./config";

function sanitizedErrorCode(value: string | null | undefined) {
  return value && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : value ? "provider_error" : null;
}

export function sanitizeVirtualTryOnProviderLog(input: { view: AppearanceView; imageCount: number; promptHash: string; taskId?: string | null; status: string; cost?: string | null; errorCode?: string | null; outputUrl?: string; apiKey?: string }) {
  return { requestSnapshot: { view: input.view, imageCount: input.imageCount, promptHash: input.promptHash }, responseSummary: { taskId: input.taskId ?? null, status: input.status, cost: input.cost ?? null }, errorCode: sanitizedErrorCode(input.errorCode) };
}
