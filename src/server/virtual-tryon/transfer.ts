import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import { createR2Client, getR2Config } from "@/lib/storage/r2-client";

type UploadClient = Pick<S3Client, "send">;
export class VirtualTryOnTransferError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, status?: number) { super(code); this.name = "VirtualTryOnTransferError"; this.code = code; this.status = status; }
}
const maxBytes = 25 * 1024 * 1024;
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal" || host.includes(":")) return true;
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const octets = parts.map(Number);
  return octets.some((part) => part > 255) || octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168);
}
function safeUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || isBlockedHost(parsed.hostname)) throw new Error("rejected");
    return parsed;
  } catch { throw new VirtualTryOnTransferError("virtual_tryon_output_url_rejected"); }
}
async function readLimited(response: Response, signal: AbortSignal) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let received = 0;
  const aborted = new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new VirtualTryOnTransferError("timeout")), { once: true });
  });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), aborted]);
      if (next.done) break;
      received += next.value.byteLength;
      if (received > maxBytes) throw new VirtualTryOnTransferError("virtual_tryon_output_too_large");
      chunks.push(next.value);
    }
  } catch (error) {
    if (error instanceof VirtualTryOnTransferError) throw error;
    if (signal.aborted) throw new VirtualTryOnTransferError("timeout");
    throw new VirtualTryOnTransferError("network_error");
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function transferVirtualTryOnImageToR2(input: { url: string; key: string; bucket?: string; client?: UploadClient; fetch?: typeof fetch; timeoutMs?: number }) {
  const url = safeUrl(input.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(input.timeoutMs ?? 25_000, 25_000));
  let response: Response;
  try {
    response = await (input.fetch ?? fetch)(url, { redirect: "error", signal: controller.signal });
    if (!response.ok) {
      if (response.status >= 300 && response.status < 400) throw new VirtualTryOnTransferError("virtual_tryon_output_redirect_rejected", response.status);
      throw new VirtualTryOnTransferError("http_" + response.status, response.status);
    }
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (!imageTypes.has(contentType)) throw new VirtualTryOnTransferError("virtual_tryon_output_content_type_rejected");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new VirtualTryOnTransferError("virtual_tryon_output_too_large");
    const body = await readLimited(response, controller.signal);
    clearTimeout(timeout);
    await (input.client ?? createR2Client()).send(new PutObjectCommand({ Bucket: input.bucket ?? getR2Config().bucket, Key: input.key, Body: body, ContentType: contentType }));
    return { key: input.key, contentType, fileSize: body.byteLength };
  } catch (error) {
    if (error instanceof VirtualTryOnTransferError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw new VirtualTryOnTransferError("timeout");
    throw new VirtualTryOnTransferError("network_error");
  } finally { clearTimeout(timeout); }
}
