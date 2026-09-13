/**
 * Where a correct password sends somebody — one decision, four answers.
 *
 * ## Why this is a function and not an `if` in three login actions
 *
 * Each app answers this for itself today, and the three answers had already drifted: RevioLink and
 * RevioCRS refused the sign-in outright when the product's entitlement was off, which made the
 * ended-trial screen unreachable for exactly the hotels it was written for (fixed 2026-09-13), while
 * RevioPMS had always let them in and shown it. A single front door cannot be built on three
 * different opinions about what a valid password means.
 *
 * Codex asked for these states to be named before the website says anything about one login, so they
 * are named here, in code, rather than in a paragraph that can go stale.
 *
 * ## The four answers
 *
 * | | What it means | What the person sees |
 * | --- | --- | --- |
 * | `open` | Signed in, and this product is theirs | The product |
 * | `locked` | Signed in, this product is not on their account | `ProductLocked` — trial ended, or a real offer |
 * | `elsewhere` | Signed in, but they asked for a product they have never had while owning others | The product they do have |
 * | `refused` | The ACCOUNT is not usable, not just this product | A sentence, and no session |
 *
 * ⚠️ **`locked` is not `refused`.** That distinction is the whole of the Day 31 promise: the hotel
 * is a real user of an active account, so they sign in and meet a screen that names the end date,
 * says nothing was deleted and offers "I want to keep it". Collapsing it into `refused` is precisely
 * the bug that was live until 13 September.
 *
 * ⚠️ **Suspension is about the ACCOUNT, so it is the one case that stops at the door.** A suspended
 * hotel has no product to be routed to and no screen inside to explain it; issuing a session would
 * mean every app had to re-answer the same question, which is how the three drifted in the first
 * place.
 */

import { PRODUCT_BY_KEY, type ProductKey } from "../products/products.js";

export interface LoginEntitlements {
  cm: boolean;
  crs: boolean;
  pms: boolean;
}

export type LoginDecision =
  | { kind: "open"; product: ProductKey }
  | { kind: "locked"; product: ProductKey; alsoOpen: ProductKey[] }
  | { kind: "elsewhere"; product: ProductKey; instead: ProductKey }
  | { kind: "refused"; reason: "suspended" | "no-products"; message: string };

/** RevioLink, then RevioCRS, then RevioPMS — the order an owner is offered products in. */
export const PRODUCT_ORDER: ProductKey[] = ["cm", "crs", "pms"];

const held = (e: LoginEntitlements, k: ProductKey) => (k === "cm" ? e.cm : k === "crs" ? e.crs : e.pms);

/** Every product this account can actually open, in the house order. */
export function openProducts(e: LoginEntitlements): ProductKey[] {
  return PRODUCT_ORDER.filter((k) => held(e, k));
}

export function loginDestination(args: {
  /** `active` is the only tenant status that may hold a session. */
  tenantStatus: string;
  entitlements: LoginEntitlements;
  /**
   * Which product they were trying to reach — the origin they typed, or the one a central login was
   * asked for. `null` means "no preference": send them to the first product they own.
   */
  requested: ProductKey | null;
  /**
   * Has this account ever trialled the requested product? It changes what the locked screen says —
   * an ended trial and a product they never had are different conversations — but never whether
   * they get in.
   */
  everTrialled?: boolean;
}): LoginDecision {
  const { tenantStatus, entitlements, requested } = args;

  if (tenantStatus !== "active") {
    return {
      kind: "refused",
      reason: "suspended",
      // Says what to do. "Contact Revio" is the only next step that exists, so it is the message.
      message: "This account is suspended — contact Revio.",
    };
  }

  const open = openProducts(entitlements);

  /*
   * No products at all and nothing ever trialled: there is no screen inside to show them, because
   * every screen lives behind a product. This is a real state — an operator can switch everything
   * off — and it must not become a blank app.
   */
  if (open.length === 0 && !args.everTrialled) {
    return {
      kind: "refused",
      reason: "no-products",
      message: "No Revio product is switched on for this hotel yet — contact Revio and we will sort it out.",
    };
  }

  if (!requested) {
    // No preference. The first product they own; if they own none but have history, the locked
    // screen for the one they most recently could have had.
    return open.length > 0
      ? { kind: "open", product: open[0]! }
      : { kind: "locked", product: PRODUCT_ORDER[0]!, alsoOpen: [] };
  }

  if (held(entitlements, requested)) return { kind: "open", product: requested };

  /*
   * They asked for something they do not hold. Two different situations, and only one of them is
   * worth interrupting for:
   *
   * - They have NEVER had it and they own something else → send them where they were going
   *   (`elsewhere`). Landing a hotel on a sales screen for a product they never asked about, when
   *   they were trying to open the software they pay for, is an advert in the way of their work.
   * - They HAVE had it → the locked screen, because "your trial ended, nothing was deleted, keep
   *   it?" is a conversation they are owed and the only place it happens.
   */
  if (!args.everTrialled && open.length > 0) {
    return { kind: "elsewhere", product: requested, instead: open[0]! };
  }

  return { kind: "locked", product: requested, alsoOpen: open };
}

/** The sentence for a refusal, or null when there is nothing to refuse. */
export function refusalMessageFor(d: LoginDecision): string | null {
  return d.kind === "refused" ? d.message : null;
}

/** "RevioCRS" — for a message that has to name where somebody is being sent. */
export function productLabel(key: ProductKey): string {
  return PRODUCT_BY_KEY[key]?.name ?? key;
}
