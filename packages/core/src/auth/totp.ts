import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238), for N4.
 *
 * Written here rather than pulled from a package for one reason: RFC 6238 publishes test vectors,
 * so this can be *proved* correct against the standard instead of trusted. It is about sixty lines
 * of HMAC, and a dependency in the authentication path is a dependency that can be compromised or
 * abandoned. `totp.test.ts` runs the RFC's own table for SHA-1, SHA-256 and SHA-512.
 *
 * Everything is pure and synchronous — no clock is read here, no storage is touched. The caller
 * passes the time, which is what makes the window behaviour testable at all.
 */

/** RFC 6238 §4: 30 seconds is the near-universal choice, and every authenticator app assumes it. */
export const TOTP_PERIOD_SECONDS = 30;
/** Six digits is what the apps display. */
export const TOTP_DIGITS = 6;

/**
 * How many steps either side of now are accepted.
 *
 * One step (±30s) covers the ordinary case: a phone whose clock has drifted slightly, or a person
 * who starts typing at 29 seconds. It is deliberately not larger — every extra step widens the
 * window in which a shoulder-surfed or phished code still works, and the whole value of TOTP is
 * that a stolen code expires almost immediately.
 */
export const TOTP_WINDOW_STEPS = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A new shared secret, base32-encoded the way authenticator apps expect. */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(secret: string): Buffer {
  // Authenticator apps show the secret in spaced groups and users paste it back with the spaces,
  // and some encoders pad with "=". Both are the same secret.
  const clean = secret.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`base32Decode: "${ch}" is not a base32 character`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export type TotpAlgorithm = "sha1" | "sha256" | "sha512";

/** The code for one specific counter value. RFC 4226 §5.3, which RFC 6238 builds on. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS, algorithm: TotpAlgorithm = "sha1"): string {
  const buf = Buffer.alloc(8);
  // The counter is 64-bit big-endian. Written as two 32-bit halves because a JS number cannot hold
  // 64 bits exactly — at 30-second steps the high half stays zero until the year 10 000, but doing
  // it properly costs one line.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac(algorithm, secret).update(buf).digest();
  // Dynamic truncation: the low nibble of the last byte picks where to read the 31-bit code from.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The code for a moment in time. `atMs` is passed in so tests can stand still. */
export function totp(
  secretBase32: string,
  atMs: number,
  opts: { digits?: number; period?: number; algorithm?: TotpAlgorithm } = {},
): string {
  const period = opts.period ?? TOTP_PERIOD_SECONDS;
  const counter = Math.floor(atMs / 1000 / period);
  return hotp(base32Decode(secretBase32), counter, opts.digits ?? TOTP_DIGITS, opts.algorithm ?? "sha1");
}

/**
 * Is this the code for now, or near enough?
 *
 * Compared with `timingSafeEqual`, so the answer takes the same time whether the first digit is
 * wrong or only the last. A six-digit code is a small space — a million values — and a comparison
 * that returns early on the first mismatch leaks how much of a guess was right.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  atMs: number,
  opts: { window?: number; digits?: number; period?: number; algorithm?: TotpAlgorithm } = {},
): boolean {
  const digits = opts.digits ?? TOTP_DIGITS;
  const candidate = code.replace(/\s/g, "");
  if (!new RegExp(`^\\d{${digits}}$`).test(candidate)) return false;

  const window = opts.window ?? TOTP_WINDOW_STEPS;
  const period = opts.period ?? TOTP_PERIOD_SECONDS;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(atMs / 1000 / period);

  let ok = false;
  for (let drift = -window; drift <= window; drift++) {
    const expected = hotp(secret, counter + drift, digits, opts.algorithm ?? "sha1");
    // Every step is checked even after a match, so the time taken does not reveal WHICH step
    // matched — that would narrow a phished code's age.
    const a = Buffer.from(expected);
    const b = Buffer.from(candidate);
    if (a.length === b.length && timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

/**
 * The `otpauth://` URI an authenticator app scans.
 *
 * `issuer` appears twice on purpose — as the label prefix and as a parameter. Older apps read one,
 * newer ones the other, and an account that shows up as a bare email address among thirty others is
 * one a person deletes by mistake.
 */
export function totpUri(input: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Recovery codes — the answer to "my phone is in a taxi".
 *
 * Without them, enabling 2FA on the console that can read every hotel's data means one lost handset
 * locks the operator out of their own product permanently. Ten single-use codes, shown once.
 *
 * They are stored hashed, exactly like passwords, because a database that leaks recovery codes
 * leaks the second factor entirely — and the format is deliberately unmistakable so nobody files
 * one as a password.
 */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(10)).slice(0, 10).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** Normalise before hashing or comparing: people retype these with the dash and the case wrong. */
export function normaliseRecoveryCode(code: string): string {
  return code.trim().toLowerCase().replace(/[\s-]/g, "");
}
