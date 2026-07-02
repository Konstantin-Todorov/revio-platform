import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets at rest (connectivity API keys). The data key is derived from
 * CONNECTIVITY_SECRET (falls back to AUTH_SECRET so one well-kept secret suffices; dev fallback last).
 * Ciphertext format: base64(iv).base64(tag).base64(data) — one string column, self-contained.
 */
function dataKey(): Buffer {
  const secret =
    process.env.CONNECTIVITY_SECRET || process.env.AUTH_SECRET || "dev-insecure-secret-change-in-prod";
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${data.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", dataKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** For UI display only: the last 4 characters of a key, never more. */
export function keyHint(plain: string): string {
  return plain.length > 4 ? `••••${plain.slice(-4)}` : "••••";
}
