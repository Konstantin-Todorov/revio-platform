/**
 * Cloudflare Turnstile — deciding whether a signup came from a person.
 *
 * ## What this is for
 *
 * `/signup` is the one unauthenticated write in the staff products: it creates a tenant, a property
 * and an owner account, and emails a link that sets a password. A script can run it all day. The
 * damage is not a breach — it is a console full of fiction, a Resend reputation spent on addresses
 * nobody typed, and a trial-abuse signal that means nothing because half the rows are noise.
 *
 * ⚠️ **Turnstile is a filter, never a gate on a real hotel.** The standing decision on this signup
 * form — made when disposable-email refusal was reversed — is that an abusive trial costs us thirty
 * days of software that is nearly free to serve, while a real hotel turned away at the door assumes
 * the product is not for them and never tells us. One mistake is recoverable, the other is
 * invisible. So a challenge that cannot be reached, times out, or is misconfigured must never be the
 * reason somebody cannot become a customer.
 *
 * ## Status code, never the shape of the answer
 *
 * `verifyTurnstile` branches on the HTTP status first and on `success` second. A Cloudflare error is
 * valid JSON, and `json.success` on it is simply `undefined` — indistinguishable from a failed
 * challenge if you read the field alone. That exact trap produced 411 consecutive "success" sync
 * events against a revoked Channex key, and it is written down here so it is not re-learned a fourth
 * time.
 *
 * Pure: an HTTP result in, a verdict out. The fetch lives in the caller.
 */

export interface TurnstileVerdict {
  /** May this signup proceed? */
  ok: boolean;
  /**
   * Why, in one phrase, for the log. Never shown to the person: a bot does not read error messages
   * and a real customer should not be told which control they tripped.
   */
  reason: string;
  /**
   * True when we allowed it WITHOUT a verdict — not configured, or Cloudflare did not answer. Worth
   * a log line every time, because a long run of these means the filter is off and nobody noticed.
   */
  unverified: boolean;
}

/** Cloudflare's documented response, as much of it as we read. */
export interface TurnstileResponse {
  success?: boolean;
  "error-codes"?: string[];
}

/**
 * Turn Cloudflare's answer into a decision.
 *
 * @param status  the HTTP status. A non-200 means Cloudflare did not answer the question, which is
 *   not the same as answering "no".
 */
export function readTurnstileResult(status: number, body: TurnstileResponse | null): TurnstileVerdict {
  if (status !== 200 || body == null) {
    // Their outage is not the customer's fault. Allow, and say so loudly enough to be noticed.
    return { ok: true, reason: `turnstile unreachable (HTTP ${status})`, unverified: true };
  }
  if (body.success === true) return { ok: true, reason: "passed", unverified: false };

  const codes = body["error-codes"] ?? [];
  /*
   * ⚠️ These two mean OUR configuration is wrong, not that the visitor is a bot.
   *
   * Refusing here would turn a mistyped secret into "no hotel can sign up", discovered by a customer
   * who simply gives up. Allow, and make the log say which one it was.
   */
  if (codes.some((c) => c === "invalid-input-secret" || c === "missing-input-secret")) {
    return { ok: true, reason: `turnstile misconfigured (${codes.join(",")})`, unverified: true };
  }
  return { ok: false, reason: codes.length ? codes.join(",") : "challenge failed", unverified: false };
}

/**
 * The verdict when no secret is configured at all.
 *
 * Deliberately permissive. The code ships before the keys exist — that is the only order that works,
 * since a widget with no site key renders nothing and a form with a mandatory token nobody can
 * produce is a signup page that refuses everybody. `unverified` is what makes it visible rather than
 * silent.
 */
export function turnstileNotConfigured(): TurnstileVerdict {
  return { ok: true, reason: "turnstile not configured", unverified: true };
}
