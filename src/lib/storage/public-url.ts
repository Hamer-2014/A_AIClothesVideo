export function createR2PublicUrl({
  key,
  publicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL,
}: {
  key: string;
  publicBaseUrl?: string;
}) {
  const base = publicBaseUrl?.trim();
  if (!base) {
    throw new Error("CLOUDFLARE_R2_PUBLIC_BASE_URL is required for R2 public URLs.");
  }

  const parsedBase = new URL(base);
  if (
    parsedBase.protocol !== "https:" ||
    parsedBase.username ||
    parsedBase.password ||
    parsedBase.search ||
    parsedBase.hash
  ) {
    throw new Error(
      "CLOUDFLARE_R2_PUBLIC_BASE_URL must be a plain HTTPS URL.",
    );
  }

  const keySegments = key.replace(/^\/+/, "").split("/");
  if (keySegments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("R2 object key cannot contain dot path segments.");
  }

  const normalizedBase = parsedBase.toString().replace(/\/+$/, "");
  const normalizedKey = keySegments
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${normalizedBase}/${normalizedKey}`;
}
