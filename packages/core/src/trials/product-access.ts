import { PRODUCT_BY_KEY, type ProductInfo, type ProductKey } from "../products/products.js";

/**
 * What to tell a hotel that opens a product it cannot use.
 *
 * ## The screen this replaces said the wrong thing to the person most worth keeping
 *
 * All three apps showed one sentence — *"This hotel hasn't subscribed to the Channel Manager.
 * Contact Revio to enable it."* — to every hotel without the entitlement. For a hotel whose 30-day
 * trial had just ended that is **false** (they did subscribe; it finished), it is a **dead end**
 * (no address, no link, no button), and it is the last thing we say to somebody who has just spent
 * a month evaluating the product and might be about to pay for it.
 *
 * Three situations were sharing one sentence:
 *
 * 1. **Their trial ended.** They know the product. Say so, say when, and let them ask to keep it.
 * 2. **They never had it.** A real offer: thirty days, no card.
 * 3. **It was switched off by us.** Their data is untouched and a human should say why.
 *
 * ## ⚠️ It must never be a dead end
 *
 * Whatever the reason, the hotel usually still owns something — a trial ends per product, so a
 * hotel that lost RevioLink may still be in RevioCRS every morning. The screen always carries the
 * doors that DO open, because a wall with no doors is how somebody decides the whole platform is
 * broken rather than that one licence lapsed.
 */

export type ProductAccessReason = "trial-ended" | "never-had" | "switched-off";

export interface ProductAccessState {
  reason: ProductAccessReason;
  product: ProductInfo;
  /** When the trial finished — only on `trial-ended`. */
  endedAt?: Date;
  /** They already pressed "Keep it" and are waiting on us. */
  keepRequested: boolean;
  /** May they start a trial from here? False once this product has ever been trialled. */
  canStartTrial: boolean;
  /** Products they CAN open right now. Never empty advice — the doors that work. */
  stillOpen: ProductInfo[];
}

export interface TrialHistory {
  product: ProductKey;
  endedAt: Date | null;
  outcome: string | null;
  keepRequestedAt: Date | null;
}

export function productAccessState(args: {
  product: ProductKey;
  /** Every trial this tenant has ever had, finished ones included. */
  trials: TrialHistory[];
  entitlements: { cm: boolean; crs: boolean; pms: boolean };
}): ProductAccessState {
  const product = PRODUCT_BY_KEY[args.product]!;
  const mine = args.trials.filter((t) => t.product === args.product);
  // The most recent finished one — a product can only have been trialled once, but ordering makes
  // the answer deterministic rather than dependent on row order.
  const ended = mine
    .filter((t) => t.endedAt !== null)
    .sort((a, b) => b.endedAt!.getTime() - a.endedAt!.getTime())[0];

  const stillOpen = (["cm", "crs", "pms"] as ProductKey[])
    .filter((k) => k !== args.product && args.entitlements[k])
    .map((k) => PRODUCT_BY_KEY[k]!);

  const keepRequested = mine.some((t) => t.keepRequestedAt !== null);

  if (ended) {
    /*
     * A trial that a machine ended is "expired". One WE ended early is "cancelled", and that is a
     * different conversation — so it is reported as switched-off rather than dressed up as a trial
     * running its course.
     */
    const reason: ProductAccessReason = ended.outcome === "cancelled" ? "switched-off" : "trial-ended";
    return {
      reason,
      product,
      endedAt: ended.endedAt!,
      keepRequested,
      // One trial per product, ever — offering another here would be a promise the writer refuses.
      canStartTrial: false,
      stillOpen,
    };
  }

  return {
    reason: mine.length > 0 ? "switched-off" : "never-had",
    product,
    keepRequested,
    canStartTrial: mine.length === 0,
    stillOpen,
  };
}

/** The heading and the sentence under it. Kept beside the rule so the two cannot drift. */
export function productAccessCopy(
  s: ProductAccessState,
  hotelName: string,
  fmtDate: (d: Date) => string,
): { title: string; body: string } {
  switch (s.reason) {
    case "trial-ended":
      return {
        title: `Your ${s.product.name} trial has ended`,
        body:
          `The trial finished on ${s.endedAt ? fmtDate(s.endedAt) : "its end date"}. ` +
          `Nothing has been deleted — every room, rate and booking for ${hotelName} is exactly where you left it, ` +
          `and switching ${s.product.name} back on brings it all back.`,
      };
    case "switched-off":
      return {
        title: `${s.product.name} is switched off for ${hotelName}`,
        body:
          `This product isn't active on your account at the moment. Your data is untouched — ` +
          `tell us and we'll sort it out.`,
      };
    case "never-had":
      return {
        title: `${hotelName} doesn't have ${s.product.name} yet`,
        body:
          `${s.product.tagline}. It runs on the rooms and rates you already have, so there is nothing to set up twice — ` +
          `try it free for 30 days, no card.`,
      };
  }
}
