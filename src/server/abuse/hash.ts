import { createHmac } from "node:crypto";

export function hashAbuseSignal(
  value: string | null | undefined,
  secret: string,
) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return createHmac("sha256", secret).update(normalized).digest("hex");
}
