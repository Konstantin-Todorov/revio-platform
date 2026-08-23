import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  totp,
  verifyTotp,
  totpUri,
  generateTotpSecret,
  generateRecoveryCodes,
  normaliseRecoveryCode,
  TOTP_PERIOD_SECONDS,
} from "./totp.js";

/**
 * RFC 6238 Appendix B publishes a table of expected codes. Running it is the whole reason this is
 * implemented here rather than imported: the standard can be satisfied provably, not assumed.
 *
 * The RFC's seeds are ASCII strings repeated to the hash's block size; base32 is only how
 * authenticator apps carry them, so the tests encode the RFC seed rather than inventing one.
 */
const SEED_SHA1 = base32Encode(Buffer.from("12345678901234567890", "ascii"));
const SEED_SHA256 = base32Encode(Buffer.from("12345678901234567890123456789012", "ascii"));
const SEED_SHA512 = base32Encode(
  Buffer.from("1234567890123456789012345678901234567890123456789012345678901234", "ascii"),
);

describe("RFC 6238 Appendix B test vectors", () => {
  const cases: [number, string, string, "sha1" | "sha256" | "sha512"][] = [
    [59, "94287082", SEED_SHA1, "sha1"],
    [59, "46119246", SEED_SHA256, "sha256"],
    [59, "90693936", SEED_SHA512, "sha512"],
    [1111111109, "07081804", SEED_SHA1, "sha1"],
    [1111111111, "14050471", SEED_SHA1, "sha1"],
    [1111111111, "67062674", SEED_SHA256, "sha256"],
    [1111111111, "99943326", SEED_SHA512, "sha512"],
    [1111111109, "68084774", SEED_SHA256, "sha256"],
    [1111111109, "25091201", SEED_SHA512, "sha512"],
    [1234567890, "89005924", SEED_SHA1, "sha1"],
    [2000000000, "69279037", SEED_SHA1, "sha1"],
    [20000000000, "65353130", SEED_SHA1, "sha1"],
  ];

  for (const [unixSeconds, expected, seed, algorithm] of cases) {
    it(`${algorithm} at T=${unixSeconds} produces ${expected}`, () => {
      expect(totp(seed, unixSeconds * 1000, { digits: 8, algorithm })).toBe(expected);
    });
  }

  it("still matches at T=20000000000, where the counter exceeds 32 bits", () => {
    // The counter is 64-bit. A naive 32-bit write passes every other case in this table and fails
    // only here — which is the year 2603, i.e. never, until someone reuses this for something else.
    expect(totp(SEED_SHA1, 20000000000 * 1000, { digits: 8 })).toBe("65353130");
  });
});

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it("accepts the spaced, lowercase form a person pastes back", () => {
    const secret = generateTotpSecret();
    const spaced = secret.toLowerCase().replace(/(.{4})/g, "$1 ");
    expect(base32Decode(spaced)).toEqual(base32Decode(secret));
  });

  it("tolerates padding", () => {
    expect(base32Decode("MFRGG===")).toEqual(base32Decode("MFRGG"));
  });

  it("rejects a character that is not base32", () => {
    expect(() => base32Decode("MFRGG!")).toThrow(/not a base32 character/);
  });
});

describe("verifyTotp", () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;

  it("accepts the current code", () => {
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
  });

  it("accepts the previous step — a slow typist is not an attacker", () => {
    const oneStepAgo = now - TOTP_PERIOD_SECONDS * 1000;
    expect(verifyTotp(secret, totp(secret, oneStepAgo), now)).toBe(true);
  });

  it("accepts the next step — a phone clock running fast is common", () => {
    const oneStepAhead = now + TOTP_PERIOD_SECONDS * 1000;
    expect(verifyTotp(secret, totp(secret, oneStepAhead), now)).toBe(true);
  });

  it("REFUSES two steps away, so a stolen code expires quickly", () => {
    const twoStepsAgo = now - 2 * TOTP_PERIOD_SECONDS * 1000;
    expect(verifyTotp(secret, totp(secret, twoStepsAgo), now)).toBe(false);
  });

  it("refuses a code from a different secret", () => {
    expect(verifyTotp(secret, totp(generateTotpSecret(), now), now)).toBe(false);
  });

  it("refuses anything that is not six digits", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56 78", "  "]) {
      expect(verifyTotp(secret, bad, now)).toBe(false);
    }
  });

  it("ignores spaces inside an otherwise valid code", () => {
    const code = totp(secret, now);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true);
  });
});

describe("totpUri", () => {
  it("names the issuer twice, so the entry is identifiable in a crowded app", () => {
    const uri = totpUri({ secret: "ABCDEFGH", account: "operator@revio.app", issuer: "Revio" });
    expect(uri.startsWith("otpauth://totp/Revio%3Aoperator%40revio.app?")).toBe(true);
    expect(uri).toContain("issuer=Revio");
    expect(uri).toContain("secret=ABCDEFGH");
    expect(uri).toContain("period=30");
    expect(uri).toContain("digits=6");
  });
});

describe("recovery codes", () => {
  it("issues ten distinct codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("formats them so nobody mistakes one for a password", () => {
    for (const c of generateRecoveryCodes(3)) expect(c).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
  });

  it("normalises the ways a person retypes one", () => {
    const target = normaliseRecoveryCode("abcde-fghij");
    for (const variant of ["ABCDE-FGHIJ", " abcde-fghij ", "abcdefghij", "AbCdE FgHiJ"]) {
      expect(normaliseRecoveryCode(variant)).toBe(target);
    }
  });
});
