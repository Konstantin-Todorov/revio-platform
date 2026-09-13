import { PRODUCT_BY_KEY, type ProductKey } from "../products/products.js";
import { isTrialDecider } from "../auth/capabilities.js";

/**
 * May a hotel start its own trial, without ringing us?
 *
 * ## Why this reverses a decision that was written down
 *
 * `actions-trials.ts` states: *"There is no 'start free trial' button in the hotel's product,
 * deliberately… That is worth more than the friction it costs **at our size**."*
 *
 * "At our size" was the condition, and it has changed. With no customers, a call was a feature: it
 * meant somebody had decided this hotel should have the product. With customers, it is the thing
 * standing between a hotel and the platform's entire claim — *buy one, add the others, no
 * migration*. A trial that needs a phone call is a trial most people never start, and the pitch is
 * only persuasive if they can see it be true on their own data.
 *
 * So the button exists now. What does not change is that **nothing may ever begin by accident**, and
 * these are the rules that make that true rather than hoped for.
 *
 * ## The rules, and the one that matters most
 *
 * ⚠️ **One trial per product, EVER.** Not one running — one ever. The database's partial unique
 * index only prevents two at the same time, which is right for an operator granting a second look
 * by hand. Left as the only rule for self-serve it is a loop: trial, let it lapse, start another,
 * for as long as they like. Free forever, arrived at honestly, one month at a time.
 *
 * The rest are ordinary: they must already be a customer (this is expansion, not a way in), the
 * account must not be suspended, they must not already own it, and the person pressing the button
 * has to be the one who could agree to pay for it afterwards.
 */

export type SelfTrialRefusal =
  | "not_a_customer"
  | "suspended"
  | "already_owned"
  | "already_trialled"
  | "not_permitted";

export interface SelfTrialFacts {
  product: ProductKey;
  /** Which products the tenant owns right now. */
  owns: Record<ProductKey, boolean>;
  /** Products this tenant has EVER had a trial of, running or finished. */
  everTrialled: readonly ProductKey[];
  /** `active` | `suspended` | … — anything but active refuses. */
  tenantStatus: string;
  /** The role of whoever pressed it. */
  role: string;
}

export interface SelfTrialVerdict {
  ok: boolean;
  reason?: SelfTrialRefusal;
  /** What to say on screen. Always names what to do next, never only what is wrong. */
  message?: string;
}

export function canSelfStartTrial(f: SelfTrialFacts): SelfTrialVerdict {
  const info = PRODUCT_BY_KEY[f.product];
  const name = info?.name ?? f.product;

  if (!isTrialDecider(f.role)) {
    return {
      ok: false,
      reason: "not_permitted",
      message: `Starting a trial is the owner's or an admin's decision, because it is the account that keeps it afterwards. Ask one of them to switch ${name} on.`,
    };
  }

  if (f.tenantStatus !== "active") {
    return {
      ok: false,
      reason: "suspended",
      message: "This account is suspended, so nothing new can be switched on. Talk to us and we will sort it out.",
    };
  }

  if (f.owns[f.product]) {
    /*
     * Refused rather than quietly ignored. A trial of something they already own would take it away
     * on the day it ended — the single most damaging thing this button could do.
     */
    return {
      ok: false,
      reason: "already_owned",
      message: `You already have ${name}. A trial would take it away when it finished.`,
    };
  }

  /*
   * Expansion, not a way in. Every self-serve trial rides on data the hotel already has here, and a
   * tenant with no product has none — so there would be nothing to evaluate and no relationship to
   * expand. Those arrive through a demo, with a person.
   */
  const ownsSomething = (Object.keys(f.owns) as ProductKey[]).some((k) => f.owns[k]);
  if (!ownsSomething) {
    return {
      ok: false,
      reason: "not_a_customer",
      message: "A trial runs on the rooms, rates and bookings you already keep here. Ask us for a demo and we will set you up.",
    };
  }

  if (f.everTrialled.includes(f.product)) {
    return {
      ok: false,
      reason: "already_trialled",
      message: `${name} has already been trialled on this account. If you would like another look at it, reply to any Revio email and we will arrange one.`,
    };
  }

  return { ok: true };
}

/**
 * What a hotel is promised before they press it — the same list, in the same order, every time.
 *
 * Written here rather than in a template because it is the contract, not copy: each line is a thing
 * that must remain true of the implementation. If one of them stops being true, this list is what
 * should fail to compile against reality, and the tests below it are what notice.
 */
export function selfTrialPromises(product: ProductKey, days: number): string[] {
  const name = PRODUCT_BY_KEY[product]?.name ?? product;
  return [
    `${name} switches on now, for ${days} days.`,
    "Nothing is charged, and no card is asked for.",
    "It uses the rooms, rates and bookings you already keep here — there is nothing to import.",
    `We will email you ${days > 7 ? "a week" : "a few days"} before it ends, and again the day before.`,
    "If you do nothing it simply switches off. Nothing is deleted, and nothing starts charging on its own.",
    /*
     * ⚠️ This line is only allowed to exist because the invoice prorates the joining month.
     *
     * Billing whole calendar months made it false at exactly one point — the month a trial converts
     * in was charged in full, free days included. `proration.ts` is what makes the sentence true,
     * and this list is the contract that must fail if that stops being so.
     */
    `If you decide to keep ${name}, you pay from the day you decide — never for a day of the trial.`,
    /*
     * The half that makes "all three" an offer rather than a bill in waiting.
     *
     * Trials really do end per product — three `ProductTrial` rows, closed independently — and the
     * invoice prices only the entitlements that remain. So a hotel can be shown everything and keep
     * one, which is the whole argument for switching all three on at signup.
     */
    "Each product is separate at the end — keep the ones you used, and pay for those alone.",
  ];
}
