export type VirtualTryOnQueueHealth = "normal" | "delayed";

export const virtualTryOnQueueDelayMs = 2 * 60 * 1_000;

export function classifyVirtualTryOnQueueHealth(input: {
  status: string;
  attemptCount: number;
  updatedAt: Date;
  now?: Date;
}): VirtualTryOnQueueHealth {
  if (input.status !== "queued" || input.attemptCount !== 0) return "normal";
  const now = input.now ?? new Date();
  return now.getTime() - input.updatedAt.getTime() >= virtualTryOnQueueDelayMs
    ? "delayed"
    : "normal";
}
