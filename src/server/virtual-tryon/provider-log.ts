import type { AppearanceView } from "./config";

export function sanitizeVirtualTryOnProviderLog(input: { view: AppearanceView; imageCount: number; promptHash: string; taskId?: string | null; status: string; cost?: string | null; errorCode?: string | null; outputUrl?: string; apiKey?: string }) {
  return { requestSnapshot: { view: input.view, imageCount: input.imageCount, promptHash: input.promptHash }, responseSummary: { taskId: input.taskId ?? null, status: input.status, cost: input.cost ?? null }, errorCode: input.errorCode ?? null };
}
