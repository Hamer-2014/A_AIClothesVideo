import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function createProviderKeyPreview(plainKey: string) {
  const trimmed = plainKey.trim();
  if (trimmed.length <= 8) {
    return "****";
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function normalizeSecret(secret: string | undefined) {
  const value = secret?.trim() ?? "";
  if (value.length < 32) {
    throw new Error(
      "PROVIDER_KEY_ENCRYPTION_SECRET must be at least 32 characters.",
    );
  }

  return Buffer.from(value.slice(0, 32), "utf8");
}

export function encryptProviderKey(plainKey: string, secret: string | undefined) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeSecret(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainKey.trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptProviderKey(encrypted: string, secret: string | undefined) {
  const [ivRaw, tagRaw, ciphertextRaw] = encrypted.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Invalid encrypted provider key payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    normalizeSecret(secret),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
