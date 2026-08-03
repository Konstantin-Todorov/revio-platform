/**
 * Stripe Connect — the hotel's own account, not ours (booking-engine spec §2.5③).
 *
 * The whole point is that **we never touch the money**. A guest's card is authorised against the
 * hotel's Stripe account and funds settle to the hotel directly, which keeps us out of
 * payment-institution licensing, safeguarding obligations and payout reconciliation — a regulatory
 * burden that would dwarf everything else this platform does. The stated trade is that we cannot
 * take a per-booking commission without becoming a payment facilitator, and the business model is a
 * SaaS subscription, so that is the right trade.
 *
 * **Standard accounts**, not Express: the hotel keeps a full Stripe dashboard, its accountant sees an
 * account they already understand, and disputes are between the guest and the hotel where they
 * belong. It also means we never render a payout UI.
 *
 * Mock-first, exactly like the rest of the gateway. With no `sk_test_` key this returns believable
 * fake objects so the whole onboarding screen, the request-to-book fallback and the switch between
 * them can be demonstrated and tested without a Stripe account existing at all.
 *
 * **`chargesEnabled` is Stripe's opinion, never ours.** An account can finish onboarding and still
 * not accept charges — verification pending, a missing document, a restricted country. Guessing
 * would mean promising a guest a guarantee that silently fails, so the flag is only ever copied from
 * what Stripe reports.
 */

export type ConnectStatus = {
  accountId: string;
  /** Stripe says this account can accept charges right now. The only thing the engine keys off. */
  chargesEnabled: boolean;
  /** Onboarding form submitted. True with chargesEnabled false = Stripe is still verifying. */
  detailsSubmitted: boolean;
  mode: "mock" | "stripe_test";
  error?: string;
};

function stripeKey(): string | null {
  const k = process.env.STRIPE_SECRET_KEY;
  return k && k.startsWith("sk_test_") ? k : null; // TEST keys only — never a live key
}

export function connectMode(): "mock" | "stripe_test" {
  return stripeKey() ? "stripe_test" : "mock";
}

async function stripeCall(
  path: string,
  key: string,
  body?: Record<string, string>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  return { status: res.status, json: await res.json() };
}

/**
 * Create the hotel's connected account.
 *
 * In mock mode the id is stable-ish but unique, so two properties in a demo never collide on the
 * unique index that stops one hotel's guarantees landing in another's balance.
 */
export async function createConnectAccount(opts: {
  propertyName: string;
  email: string | null;
  country: string;
}): Promise<{ ok: boolean; accountId?: string; mode: "mock" | "stripe_test"; error?: string }> {
  const key = stripeKey();
  if (!key) {
    const rand = Math.random().toString(36).slice(2, 10);
    return { ok: true, accountId: `acct_mock_${rand}`, mode: "mock" };
  }
  try {
    const { json } = await stripeCall("accounts", key, {
      type: "standard",
      country: opts.country,
      ...(opts.email ? { email: opts.email } : {}),
      "business_profile[name]": opts.propertyName,
    });
    if (json?.error) return { ok: false, mode: "stripe_test", error: json.error.message };
    return { ok: true, accountId: json.id, mode: "stripe_test" };
  } catch (e) {
    return { ok: false, mode: "stripe_test", error: e instanceof Error ? e.message : "connect error" };
  }
}

/**
 * A one-time link into Stripe's hosted onboarding.
 *
 * Single-use and short-lived by Stripe's design, which is why the screen generates one on click
 * rather than storing it. `refreshUrl` is where Stripe sends someone whose link expired — it must
 * come back to us so we can mint a fresh one, otherwise a hotel that takes a coffee break is stuck.
 */
export async function createOnboardingLink(
  accountId: string,
  urls: { refreshUrl: string; returnUrl: string },
): Promise<{ ok: boolean; url?: string; mode: "mock" | "stripe_test"; error?: string }> {
  const key = stripeKey();
  // In mock mode we send the hotel straight back to the return URL: there is no Stripe to visit, and
  // a dead link would make the demo look broken rather than mocked.
  if (!key) return { ok: true, url: `${urls.returnUrl}?mock=1`, mode: "mock" };
  try {
    const { json } = await stripeCall("account_links", key, {
      account: accountId,
      refresh_url: urls.refreshUrl,
      return_url: urls.returnUrl,
      type: "account_onboarding",
    });
    if (json?.error) return { ok: false, mode: "stripe_test", error: json.error.message };
    return { ok: true, url: json.url, mode: "stripe_test" };
  } catch (e) {
    return { ok: false, mode: "stripe_test", error: e instanceof Error ? e.message : "connect error" };
  }
}

/**
 * Ask Stripe what this account can actually do.
 *
 * Polled when the hotel returns from onboarding and whenever the screen loads, rather than waited
 * for by webhook. A webhook is the better long-term answer and the field this writes is the same
 * either way; polling is what makes the feature work today without a public endpoint, a signing
 * secret and a replay story.
 *
 * A mock account reports itself ready — the demo needs the *connected* path to be reachable, and the
 * unconnected path is already reachable by simply not connecting.
 */
export async function getConnectStatus(accountId: string): Promise<ConnectStatus> {
  const key = stripeKey();
  if (!key) {
    return { accountId, chargesEnabled: true, detailsSubmitted: true, mode: "mock" };
  }
  try {
    const { json } = await stripeCall(`accounts/${encodeURIComponent(accountId)}`, key);
    if (json?.error) {
      return {
        accountId,
        chargesEnabled: false,
        detailsSubmitted: false,
        mode: "stripe_test",
        error: json.error.message,
      };
    }
    return {
      accountId,
      chargesEnabled: !!json.charges_enabled,
      detailsSubmitted: !!json.details_submitted,
      mode: "stripe_test",
    };
  } catch (e) {
    // Fail CLOSED: an unreachable Stripe means we do not know, and "we do not know" must degrade to
    // request-to-book rather than to taking a guarantee we cannot honour.
    return {
      accountId,
      chargesEnabled: false,
      detailsSubmitted: false,
      mode: "stripe_test",
      error: e instanceof Error ? e.message : "connect error",
    };
  }
}
