/**
 * Ask Stripe whether a key works, and report what it actually said.
 *
 * ## The rule this file exists to obey
 *
 * **Check the status code. Never the shape of the answer.**
 *
 * That is written in the root `CLAUDE.md` about Channex, where an unauthenticated request returns
 * `401` with no `data` key and `data.length ?? 0` reads it as an empty account — a mistake that
 * caused three incidents here, the worst being 411 consecutive "Pulled 0 revisions · success" events
 * against a real hotel whose key had been revoked. Stripe has the identical trap: an error response
 * is still valid JSON, and `json.id` on it is simply `undefined`. So every branch below keys off
 * `res.status` and nothing else.
 *
 * ## The second rule, which the Channex version does not have
 *
 * **A failure to REACH Stripe is not a bad key.** Rate limits, timeouts and Stripe's own outages all
 * fail, and reporting them as "rejected" sends somebody to roll a credential that was fine — which
 * costs them the ten minutes of downtime that rolling a key causes. `reachable` separates "Stripe
 * answered and said no" from "we never got an answer", and the screen shows them differently.
 */

import { STRIPE_API_VERSION } from "./stripe-api-version";
import type { StripeMode } from "./stripe-key";

export interface StripeAccountInfo {
  accountId: string | null;
  /** What a person would call this account — the display name, falling back to the legal name. */
  displayName: string | null;
  country: string | null;
  defaultCurrency: string | null;
  email: string | null;
  /** Stripe's opinion, never ours. An account can be fully onboarded and still not accept charges. */
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  detailsSubmitted: boolean | null;
  /** What Stripe says the mode is. Compared against the mode we believe — see `modeMismatch`. */
  livemode: boolean | null;
  /** Available and pending balance, per currency, in minor units. Empty on a fresh account. */
  balances: { currency: string; availableMinor: number; pendingMinor: number }[];
}

export interface StripeCheck {
  ok: boolean;
  /** Did Stripe answer at all? False means a network or outage problem, NOT a bad key. */
  reachable: boolean;
  /** The HTTP status Stripe returned. 0 when we never got one. */
  status: number;
  /** One sentence, written to be read by a person and shown verbatim on the screen. */
  message: string;
  /** Null unless the key authenticated. */
  account: StripeAccountInfo | null;
  /**
   * The key authenticated, but against the OTHER mode.
   *
   * Should be impossible — the prefix is validated before the key is ever stored — so if it happens
   * something is genuinely wrong and it must not be swallowed.
   */
  modeMismatch: boolean;
}

const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 10_000;

async function call(path: string, key: string): Promise<{ status: number; json: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/${path}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        // Pin the API version so a Stripe upgrade cannot change the shape of what we read here
        // without somebody choosing it.
        "Stripe-Version": STRIPE_API_VERSION,
      },
      signal: controller.signal,
    });
    // Parsed defensively: a gateway error in front of Stripe returns HTML, and `.json()` on that
    // throws — which would otherwise surface as "unreachable" when we did in fact get a status.
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch {
    return null; // aborted, DNS, TLS, offline — no status at all
  } finally {
    clearTimeout(timer);
  }
}

function str(o: Record<string, unknown>, k: string): string | null {
  const v = o[k];
  return typeof v === "string" && v.length > 0 ? v : null;
}
function bool(o: Record<string, unknown>, k: string): boolean | null {
  const v = o[k];
  return typeof v === "boolean" ? v : null;
}
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Stripe's error envelope, when there is one. Used only to make the message specific. */
function stripeErrorMessage(json: unknown): string | null {
  const root = obj(json);
  const err = root && obj(root.error);
  return err ? str(err, "message") : null;
}

function readBalances(json: unknown): { currency: string; availableMinor: number; pendingMinor: number }[] {
  const root = obj(json);
  if (!root) return [];
  const pick = (key: string): Map<string, number> => {
    const out = new Map<string, number>();
    const arr = root[key];
    if (!Array.isArray(arr)) return out;
    for (const entry of arr) {
      const e = obj(entry);
      if (!e) continue;
      const currency = str(e, "currency");
      const amount = typeof e.amount === "number" ? e.amount : null;
      if (currency && amount !== null) out.set(currency.toUpperCase(), amount);
    }
    return out;
  };
  const available = pick("available");
  const pending = pick("pending");
  const currencies = new Set([...available.keys(), ...pending.keys()]);
  return [...currencies].sort().map((currency) => ({
    currency,
    availableMinor: available.get(currency) ?? 0,
    pendingMinor: pending.get(currency) ?? 0,
  }));
}

/**
 * Exercise a Stripe secret key.
 *
 * Two calls, both read-only and both cheap: the account (who this is, and what Stripe permits it to
 * do) and the balance (what is actually there, and an independent statement of the mode). Nothing
 * here writes, so a check can be pressed as often as somebody likes.
 */
export async function checkStripeKey(key: string, mode: StripeMode): Promise<StripeCheck> {
  const account = await call("account", key);

  if (account === null) {
    return {
      ok: false,
      reachable: false,
      status: 0,
      message: "Could not reach Stripe — no answer within 10 seconds. This says nothing about the key; try again, and check status.stripe.com if it keeps happening.",
      account: null,
      modeMismatch: false,
    };
  }

  // Every branch below is decided by the STATUS, never by whether a field we hoped for is present.
  if (account.status === 401) {
    return {
      ok: false, reachable: true, status: 401, account: null, modeMismatch: false,
      message: stripeErrorMessage(account.json)
        ?? "Stripe rejected this key. It has been rolled, deleted, or belongs to a different account.",
    };
  }
  if (account.status === 403) {
    return {
      ok: false, reachable: true, status: 403, account: null, modeMismatch: false,
      message: "This key is valid but not permitted to read the account. If it is a restricted key, give it read access to Account, or use the standard secret key.",
    };
  }
  if (account.status === 429) {
    return {
      ok: false, reachable: true, status: 429, account: null, modeMismatch: false,
      // Explicitly NOT a bad key. Saying so stops somebody rolling a working credential.
      message: "Stripe is rate-limiting us right now. The key is not the problem — wait a moment and check again.",
    };
  }
  if (account.status >= 500) {
    return {
      ok: false, reachable: true, status: account.status, account: null, modeMismatch: false,
      message: `Stripe returned ${account.status} — their side, not ours, and not the key. Try again shortly.`,
    };
  }
  if (account.status !== 200) {
    return {
      ok: false, reachable: true, status: account.status, account: null, modeMismatch: false,
      message: stripeErrorMessage(account.json) ?? `Stripe answered ${account.status}, which we do not recognise. Nothing has been changed.`,
    };
  }

  const a = obj(account.json) ?? {};
  const profile = obj(a.business_profile);
  const settings = obj(a.settings);
  const dashboard = settings ? obj(settings.dashboard) : null;

  // The balance is nice-to-have: a key restricted to Account read will 403 here, and that must not
  // turn a working connection red.
  const balance = await call("balance", key);
  const balanceOk = balance?.status === 200;
  const livemode = balanceOk ? bool(obj(balance!.json) ?? {}, "livemode") : null;

  const info: StripeAccountInfo = {
    accountId: str(a, "id"),
    displayName: (dashboard ? str(dashboard, "display_name") : null) ?? (profile ? str(profile, "name") : null),
    country: str(a, "country"),
    defaultCurrency: str(a, "default_currency")?.toUpperCase() ?? null,
    email: str(a, "email"),
    chargesEnabled: bool(a, "charges_enabled"),
    payoutsEnabled: bool(a, "payouts_enabled"),
    detailsSubmitted: bool(a, "details_submitted"),
    livemode,
    balances: balanceOk ? readBalances(balance!.json) : [],
  };

  /*
   * Stripe's own statement of the mode, checked against ours.
   *
   * The prefix was validated before this key was stored, so a mismatch here should be impossible —
   * which is exactly why it is worth asserting. An impossible condition that is never checked is how
   * a live account ends up behind a screen labelled sandbox.
   */
  if (livemode !== null && livemode !== (mode === "live")) {
    return {
      ok: false, reachable: true, status: 200, account: info, modeMismatch: true,
      message: `Stripe says this key is for ${livemode ? "LIVE" : "TEST"} mode, but it is stored as ${mode}. Do not use this connection until that is resolved.`,
    };
  }

  const who = info.displayName ?? info.accountId ?? "an account";
  /*
   * `charges_enabled` is Stripe's opinion and the only thing worth keying off. An account can finish
   * onboarding and still not accept charges — verification pending, a missing document, a restricted
   * country — and a green tick that ignores it promises a payment path that silently fails.
   */
  if (info.chargesEnabled === false) {
    return {
      ok: true, reachable: true, status: 200, account: info, modeMismatch: false,
      message: `Connected to ${who}, but Stripe says this account cannot accept charges yet. Finish verification in the Stripe dashboard before relying on it.`,
    };
  }

  return {
    ok: true, reachable: true, status: 200, account: info, modeMismatch: false,
    message: `Connected to ${who}${info.country ? ` (${info.country}` : ""}${info.defaultCurrency ? `, ${info.defaultCurrency})` : info.country ? ")" : ""} in ${mode} mode.`,
  };
}
