/**
 * Invitations and password resets — issuing, checking and spending the single-use links.
 *
 * The rules (how long a link lives, what makes it unusable, what passwords are acceptable) are pure
 * and live in `@revio/core`. What is here is the part that touches randomness, hashing and the
 * database.
 *
 * ## The one rule this file exists to enforce
 *
 * **The token is generated once, emailed once, and never stored.** Only its SHA-256 lands in the
 * database. So a dump of `AuthToken` — from a backup, a stray query, a compromised read replica —
 * yields nothing that can be clicked. This is the same reasoning as storing password hashes, applied
 * to the thing that can *bypass* a password.
 *
 * `forSystem()` throughout, for the same reason as the login gate: both flows run before any session
 * exists, and a reset is by definition requested by someone who cannot sign in.
 */
import { createHash, randomBytes } from "node:crypto";
import { TOKEN_POLICY, checkToken, type TokenPurpose } from "@revio/core";
import { forSystem } from "./rls.js";

/** 32 bytes of CSPRNG, base64url. ~256 bits — not guessable, and short enough to survive a mail client. */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The only transformation between what we email and what we store. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssueArgs {
  purpose: TokenPurpose;
  email: string;
  userId?: string;
  operatorUserId?: string;
}

/**
 * Issue a link. Returns the **plaintext token, once** — the caller must put it straight into an email
 * and then forget it. There is no way to recover it afterwards, by design.
 *
 * Any outstanding token of the same purpose for the same address is invalidated first. Otherwise
 * clicking "forgot password" three times leaves three live keys to one account, and the two the user
 * did not use are the ones nobody is watching.
 */
export async function issueToken({ purpose, email, userId, operatorUserId }: IssueArgs): Promise<string> {
  const prisma = forSystem();
  const normalized = email.trim().toLowerCase();

  await prisma.authToken.updateMany({
    where: { email: normalized, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();
  await prisma.authToken.create({
    data: {
      purpose,
      tokenHash: hashToken(token),
      email: normalized,
      ...(userId ? { userId } : {}),
      ...(operatorUserId ? { operatorUserId } : {}),
      expiresAt: new Date(Date.now() + TOKEN_POLICY[purpose].ttlMs),
    },
  });

  return token;
}

export interface ResolvedToken {
  id: string;
  purpose: TokenPurpose;
  email: string;
  userId: string | null;
  operatorUserId: string | null;
}

export type TokenResolution =
  | { ok: true; token: ResolvedToken }
  | { ok: false; message: string };

/**
 * Look a token up and say whether it may be used — without spending it.
 *
 * Used to render the "choose a password" page: the visitor should be told the link is dead *before*
 * typing a password into a form that will reject it.
 *
 * An unrecognised token gets the same wording as an expired one. Distinguishing "no such token" from
 * "expired token" would let someone probe which of their guesses had ever been real.
 */
export async function resolveToken(token: string, purpose: TokenPurpose): Promise<TokenResolution> {
  const row = await forSystem().authToken.findUnique({ where: { tokenHash: hashToken(token) } });

  const dead =
    purpose === "invite"
      ? "This invitation link is not valid. Ask an owner at your hotel to send another."
      : "This reset link is not valid or has expired. Request a new one.";

  if (!row || row.purpose !== purpose) return { ok: false, message: dead };

  const check = checkToken(
    { purpose: row.purpose as TokenPurpose, expiresAt: row.expiresAt.getTime(), usedAt: row.usedAt?.getTime() ?? null },
    Date.now(),
  );
  if (!check.usable) return { ok: false, message: check.message };

  return {
    ok: true,
    token: {
      id: row.id,
      purpose: row.purpose as TokenPurpose,
      email: row.email,
      userId: row.userId,
      operatorUserId: row.operatorUserId,
    },
  };
}

/**
 * Spend the token. Returns false if someone else spent it first.
 *
 * The `usedAt: null` in the WHERE is the whole point: two submissions racing each other both pass
 * `resolveToken`, and only one wins this update. Checking-then-writing without it would let a
 * double-clicked form set a password twice, and a captured link be replayed.
 */
export async function consumeToken(tokenId: string): Promise<boolean> {
  const { count } = await forSystem().authToken.updateMany({
    where: { id: tokenId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

/** Invalidate every outstanding link for an address — used when a password is set or changed. */
export async function revokeTokensFor(email: string): Promise<void> {
  await forSystem().authToken.updateMany({
    where: { email: email.trim().toLowerCase(), usedAt: null },
    data: { usedAt: new Date() },
  });
}

/** Housekeeping: spent and long-expired rows have no further use. */
export async function pruneAuthTokens(olderThanMs = 30 * 24 * 60 * 60_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const { count } = await forSystem().authToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return count;
}
