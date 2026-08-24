import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets at rest (connectivity API keys). The data key is derived from
 * CONNECTIVITY_SECRET (falls back to AUTH_SECRET so one well-kept secret suffices).
 * Ciphertext format: base64(iv).base64(tag).base64(data) — one string column, self-contained.
 *
 * Fail-closed in production, for the same reason the session signing key is: the previous fallback
 * meant a service with neither variable set would happily encrypt every hotel's OTA credentials under
 * a key committed to this repository, and report success while doing it. "Encrypted at rest" with a
 * public key is not encryption, it is base64 with extra steps — and nothing would have alerted us.
 */
function dataKey(): Buffer {
  const secret = process.env.CONNECTIVITY_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Neither CONNECTIVITY_SECRET nor AUTH_SECRET is set. Refusing to encrypt credentials with a known key.",
      );
    }
    return createHash("sha256").update("dev-insecure-secret-change-in-prod").digest();
  }

  return createHash("sha256").update(secret).digest();
}

/**
 * The PREVIOUS key, during a rotation (N5).
 *
 * Rotating an encryption key is not a swap: every row already in the database is sealed with the old
 * one, and changing the variable alone turns every stored OTA credential into noise — silently, and
 * only discovered the next time a hotel's rates fail to push.
 *
 * So a rotation has three steps, and this variable is what makes the middle one possible:
 *
 *   1. Set `CONNECTIVITY_SECRET_PREVIOUS` to the current key, and `CONNECTIVITY_SECRET` to the new
 *      one. Reads now try the new key and fall back to the old, so nothing breaks and no window
 *      exists where credentials are unreadable.
 *   2. Run `pnpm --filter @revio/db rotate-connectivity-key`, which re-encrypts every row under the
 *      new key. It is idempotent and safe to re-run.
 *   3. Remove `CONNECTIVITY_SECRET_PREVIOUS`. Anything still readable only by the old key would now
 *      fail loudly — which is the point: the rotation is finished or it is not.
 */
function previousDataKey(): Buffer | null {
  const secret = process.env.CONNECTIVITY_SECRET_PREVIOUS;
  return secret ? createHash("sha256").update(secret).digest() : null;
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

  const attempt = (key: Buffer): string => {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  };

  try {
    return attempt(dataKey());
  } catch (err) {
    // GCM authenticates, so a wrong key throws rather than returning plausible rubbish. That is what
    // makes trying the previous key safe: a success under it means the row genuinely predates the
    // rotation, not that we guessed.
    const previous = previousDataKey();
    if (!previous) throw err;
    return attempt(previous);
  }
}

/** True while a rotation is in progress — the re-encrypt script and the docs both check this. */
export function hasPreviousKey(): boolean {
  return previousDataKey() !== null;
}

/** For UI display only: the last 4 characters of a key, never more. */
export function keyHint(plain: string): string {
  return plain.length > 4 ? `••••${plain.slice(-4)}` : "••••";
}
