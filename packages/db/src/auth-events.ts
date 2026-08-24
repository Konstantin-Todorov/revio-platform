import { forSystem } from "./rls.js";

/**
 * Recording what happens to an account (N5).
 *
 * The platform already logs what somebody did to a hotel's data. This is the other half: what
 * happened to the account that did it. Signing in, failing to, changing a password, turning a second
 * factor on or off, burning a recovery code, ending every session.
 *
 * The question it exists to answer is the one asked after something has gone wrong — "who signed in
 * as me, and from where" — and it cannot be answered retrospectively. Either it was recorded at the
 * time or it is gone.
 */

export const AUTH_EVENT = {
  signIn: "sign_in",
  signInFailed: "sign_in_failed",
  signInBlocked: "sign_in_blocked",
  twoFactorPassed: "two_factor_passed",
  twoFactorFailed: "two_factor_failed",
  recoveryCodeUsed: "recovery_code_used",
  twoFactorEnabled: "two_factor_enabled",
  twoFactorDisabled: "two_factor_disabled",
  passwordChanged: "password_changed",
  passwordResetRequested: "password_reset_requested",
  sessionsRevoked: "sessions_revoked",
  inviteSent: "invite_sent",
  signOut: "sign_out",
} as const;

export type AuthEventType = (typeof AUTH_EVENT)[keyof typeof AUTH_EVENT];
/**
 * Which front door — or `account` for events that belong to no single one.
 *
 * A hotel staff member has ONE identity across RevioLink, RevioCRS and RevioPMS, so changing their
 * password is not a thing that happened in an app: it happened to the person, and it ends their
 * sessions everywhere. Filing it under whichever app they happened to click the emailed link from
 * would be a fact about the email client, not about the account.
 */
export type AuthEventScope = "cm" | "crs" | "pms" | "operator" | "account";

export interface RecordAuthEventInput {
  scope: AuthEventScope;
  type: AuthEventType;
  userId?: string | null;
  operatorUserId?: string | null;
  /** Null for operator events and for failures against an unknown address — see the RLS policy. */
  tenantId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
}

/**
 * Write one event. Never throws.
 *
 * A failure to record a sign-in must not fail the sign-in. That sounds like the usual
 * swallow-everything mistake and is the opposite: this is an OBSERVER, and an observer that can
 * break the thing it watches is worse than no observer. The alternative — a full disk or a slow
 * write locking a hotel out of its own front desk at 7am — is a real outage traded for a log line.
 *
 * On the system perimeter because a sign-in is resolved before any tenant context exists, and a
 * failure against an unknown address has no tenant at all.
 */
export async function recordAuthEvent(input: RecordAuthEventInput): Promise<void> {
  try {
    await forSystem().authEvent.create({
      data: {
        scope: input.scope,
        type: input.type,
        userId: input.userId ?? null,
        operatorUserId: input.operatorUserId ?? null,
        tenantId: input.tenantId ?? null,
        email: input.email?.trim().toLowerCase() ?? null,
        ip: input.ip ?? null,
        // Truncated: a user-agent is unbounded input from the client, and the useful part is the
        // first hundred characters. Storing the rest is a free way to let somebody bloat a table.
        userAgent: input.userAgent?.slice(0, 200) ?? null,
        detail: input.detail?.slice(0, 300) ?? null,
      },
    });
  } catch {
    // Deliberately silent. See above.
  }
}

/**
 * The caller's IP and browser, from the request headers.
 *
 * `x-forwarded-for` is a list appended to by each proxy; the FIRST entry is the client, the rest are
 * hops. Taking the last one records our own load balancer on every single row, which looks like data
 * and is not.
 *
 * It is client-supplied and therefore spoofable. Kept anyway, because the value is in the pattern —
 * twenty attempts from one address, or a sign-in from a country the hotel has never seen — and a
 * forged header is itself worth having recorded.
 */
export function requestOrigin(headers: Headers): { ip: string | null; userAgent: string | null } {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null;
  return { ip, userAgent: headers.get("user-agent") };
}

/**
 * A user-agent string, reduced to the thing a person can act on.
 *
 * The raw string is 120 characters of version numbers that nobody reads, and showing it makes the
 * table unusable. "Chrome on macOS" is what actually answers "was that me?" — a hotelier knows what
 * they were sitting at, and does not know their Blink build number.
 *
 * Order matters: Edge and Opera both claim to be Chrome, and Chrome claims to be Safari, so the more
 * specific brands have to be tested first or everything comes out as Chrome.
 */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;

  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : null;

  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : null;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os;
}

/**
 * Has this account signed in from this address before?
 *
 * The one thing that turns an authentication log from a wall of rows into something worth reading. A
 * hotelier does not scan fifty "signed in" lines looking for an unfamiliar IP; they notice the row
 * that says the address is new.
 *
 * Deliberately narrow: it answers "new to this ACCOUNT", not "new to the platform" — an office
 * everyone else works from is still new to the manager who has only ever signed in from home.
 *
 * One indexed lookup, and it fails safe: if the query errors, the sign-in is reported as familiar
 * rather than raising a false alarm on every login because the database hiccuped.
 */
export async function isNewOrigin(
  who: { userId?: string | null; operatorUserId?: string | null },
  ip: string | null,
): Promise<boolean> {
  if (!ip) return false;
  if (!who.userId && !who.operatorUserId) return false;
  try {
    const seen = await forSystem().authEvent.count({
      where: who.userId
        ? { type: AUTH_EVENT.signIn, ip, userId: who.userId }
        : { type: AUTH_EVENT.signIn, ip, operatorUserId: who.operatorUserId! },
    });
    return seen === 0;
  } catch {
    return false;
  }
}

/** What a successful sign-in is worth saying, if anything. */
export function signInDetail(opts: { newOrigin: boolean; remembered: boolean }): string | null {
  const parts: string[] = [];
  if (opts.newOrigin) parts.push("first sign-in from this address");
  // Worth recording because it explains a session that is still alive a fortnight later.
  if (opts.remembered) parts.push("stays signed in");
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface AuthEventRow {
  id: string;
  type: string;
  scope: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: Date;
}

/**
 * A hotel's own recent authentication history.
 *
 * Scoped to the tenant by the RLS policy as well as by this query — a hotel reading another's
 * sign-ins would be worse than not offering the screen.
 */
export async function listAuthEventsForTenant(tenantId: string, limit = 100): Promise<AuthEventRow[]> {
  return forSystem().authEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
    select: { id: true, type: true, scope: true, email: true, ip: true, userAgent: true, detail: true, createdAt: true },
  });
}

/** Everything, for the operator console. */
export async function listAuthEvents(limit = 200): Promise<(AuthEventRow & { tenantId: string | null })[]> {
  return forSystem().authEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 1000),
    select: {
      id: true, type: true, scope: true, email: true, ip: true, userAgent: true, detail: true, createdAt: true,
      tenantId: true,
    },
  });
}

/**
 * Drop events older than the retention window.
 *
 * They are personal data — an address, an IP, a time — so keeping them forever is a liability rather
 * than diligence, and GDPR asks for a stated period rather than "indefinitely". A year covers the
 * disputes anybody actually has while staying short enough to defend.
 */
export const AUTH_EVENT_RETENTION_DAYS = 365;

export async function pruneAuthEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - AUTH_EVENT_RETENTION_DAYS * 86_400_000);
  const { count } = await forSystem().authEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
