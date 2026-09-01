/**
 * Does this Channex key actually work?
 *
 * Its own module rather than living beside the server actions, for two reasons: a `"use server"`
 * file may only export async server actions (so a pure helper there is counted as one), and this is
 * the piece that most needs unit tests — the distinction it draws is the one this codebase keeps
 * getting wrong.
 */

import { channexBaseUrl } from "@revio/core";
/**
 * The SAME hosts the pushing code uses — imported, never retyped.
 *
 * ⚠️ This file originally hardcoded `secure.channex.io` for production, which is **not a Channex
 * host**. Every request 401'd, and because this function's whole job is to answer "does this key
 * work", it confidently reported a perfectly good key as revoked — and I then spent an hour telling
 * the founder his key was dead, and shipped two documents saying so.
 *
 * `factory.ts` already carried a comment warning that a wrong host "fails at the worst possible
 * moment". I wrote a second copy of the host anyway. So there is no copy here now: the constant is
 * the one the adapter itself resolves from, and a check that cannot disagree with the pusher is the
 * only kind worth having.
 */

export interface KeyCheck {
  ok: boolean;
  /** HTTP status Channex answered with. 0 when the request never completed. */
  status: number;
  /** Properties this key can actually see. The number that matters — a key with 0 cannot push. */
  properties: number | null;
  message: string;
}

/**
 * Ask Channex whether a key works, right now.
 *
 * ⚠️ CHECKS THE STATUS CODE, NOT THE ARRAY. An unauthenticated Channex request answers 401 with no
 * `data` key, so `body.data?.length ?? 0` reads **zero properties** for a dead key and for an empty
 * account alike. That mistake has been made three times on this codebase, once while diagnosing the
 * very outage this function exists to prevent.
 */
export async function checkChannexKey(apiKey: string, mode: string): Promise<KeyCheck> {
  const base = channexBaseUrl(mode);
  if (!base) return { ok: false, status: 0, properties: null, message: "Unknown mode." };

  let res: Response;
  try {
    res = await fetch(`${base}/properties`, {
      headers: { "user-api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 0, properties: null, message: `Could not reach Channex: ${(e as Error).message}` };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false, status: res.status, properties: null,
      message: "Channex rejected this key. It has been revoked, regenerated, or belongs to a different account.",
    };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, properties: null, message: `Channex answered HTTP ${res.status}.` };
  }

  let properties: number | null = null;
  try {
    const body = (await res.json()) as { data?: unknown[] };
    properties = Array.isArray(body.data) ? body.data.length : null;
  } catch {
    // A 200 we cannot parse still authenticated, which is the question being asked.
  }
  return {
    ok: true, status: res.status, properties,
    message: properties === null
      ? "Key works."
      : `Key works — it can see ${properties} propert${properties === 1 ? "y" : "ies"}.`,
  };
}

