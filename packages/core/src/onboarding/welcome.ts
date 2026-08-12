/**
 * The first-run flow — which screens a hotel sees before it starts trading, and in what order.
 *
 * Separate from `setup.ts` on purpose. That module answers *"what is still missing"* and drives a
 * checklist an established hotel may return to for months. This one answers *"what do we walk them
 * through on day one"*, which is a different question with a different shape: it is finite, ordered,
 * full-screen, and it ends.
 *
 * ## The size branch
 *
 * A 12-room guesthouse and a 120-room hotel are not the same customer. The owner of the first is also
 * the receptionist and the person who will type in the prices; the second has someone whose job is
 * distribution. Asking both the same eight questions serves neither — one is overwhelmed, the other
 * is under-configured.
 *
 * So the flow branches on room count, which we already need for the pricing tier and can therefore
 * ask without adding a question. Small properties skip the steps whose defaults are safe and
 * reversible (taxes, staff); larger ones are asked, because at that size somebody owns the answer and
 * discovering it after the first invoice is worse than a screen.
 *
 * **Nothing is skipped silently.** A skipped step still appears on the checklist afterwards, and the
 * final screen states which defaults were accepted on their behalf. The difference between a good
 * default and a hidden one is whether the person can see it.
 *
 * ## Why "go live" is always last and always its own screen
 *
 * Every screen before it is reversible and reaches nobody. That last one puts a hotel's rooms on sale
 * on Booking.com. Merging it into "finish setup" would let someone go live by clicking Continue out
 * of momentum — and the failure mode of this product is not an empty account, it is a wrong number on
 * an OTA.
 */

import type { ProductName } from "./setup.js";

export type WelcomeStepKey =
  | "property"
  | "rooms"
  | "prices"
  | "taxes"
  | "team"
  | "golive";

export interface WelcomeStep {
  key: WelcomeStepKey;
  /** The screen's heading, in the hotel's language. */
  title: string;
  /** One sentence under it saying what this screen is for. */
  lead: string;
  /**
   * May be passed over from the screen itself. "Go live" never is — the whole point of that screen
   * is that somebody chose.
   */
  skippable: boolean;
}

/**
 * Above this, we stop assuming and start asking.
 *
 * 30 is the top of the first pricing tier (`tierForRooms`), so the boundary a hotel is already
 * billed against is the boundary it is onboarded against. One number, not two that drift apart.
 */
export const SMALL_PROPERTY_MAX_ROOMS = 30;

export function isSmallProperty(rooms: number): boolean {
  // An unknown or zero count is treated as small: on the very first screens we have not asked yet,
  // and showing a guesthouse owner the long flow by default is the worse of the two mistakes.
  return rooms <= SMALL_PROPERTY_MAX_ROOMS;
}

interface StepDef extends WelcomeStep {
  /** Left out for a small property — the default is safe, reversible, and stated at the end. */
  askOnlyWhenLarge?: boolean;
}

const PROPERTY: StepDef = {
  key: "property",
  title: "Confirm your property",
  lead: "We filled these in when your account was created. Change anything that looks wrong.",
  skippable: false,
};

const ROOMS: StepDef = {
  key: "rooms",
  title: "What do you sell?",
  lead: "Your room types and how many of each. Everything else is built on this.",
  skippable: false,
};

const PRICES: StepDef = {
  key: "prices",
  title: "Set a starting price",
  lead: "One price to begin with — you can vary it by date once you are trading.",
  skippable: true,
};

const TAXES: StepDef = {
  key: "taxes",
  title: "Taxes and fees",
  lead: "VAT and city tax, so every quote and invoice totals correctly.",
  skippable: true,
  askOnlyWhenLarge: true,
};

const TEAM: StepDef = {
  key: "team",
  title: "Add your team",
  lead: "Everyone gets their own login. Nobody shares a password.",
  skippable: true,
  askOnlyWhenLarge: true,
};

const GOLIVE = (product: ProductName): StepDef => ({
  key: "golive",
  title: product === "RevioLink" ? "Put your rooms on sale" : "You're ready",
  lead:
    product === "RevioLink"
      ? "Connect a channel and start sending availability. Nothing has left Revio until you do."
      : "Everything is in place. Here is what we set up for you.",
  skippable: false,
});

/** The screens for a product, in order, for a property of this size. */
export function welcomeFlow(product: ProductName, rooms: number): WelcomeStep[] {
  const small = isSmallProperty(rooms);

  const defs: StepDef[] =
    product === "RevioPMS"
      ? // The PMS sells nothing, so it never asks for a price. It needs the physical rooms instead.
        [PROPERTY, ROOMS, TAXES, TEAM, GOLIVE(product)]
      : [PROPERTY, ROOMS, PRICES, ...(product === "RevioCRS" ? [TAXES] : []), TEAM, GOLIVE(product)];

  return defs
    .filter((d) => !(small && d.askOnlyWhenLarge))
    .map(({ askOnlyWhenLarge: _ignored, ...step }) => step);
}

/** Which defaults were accepted on the hotel's behalf, to be stated plainly on the final screen. */
export function skippedForSize(product: ProductName, rooms: number): WelcomeStepKey[] {
  const full = welcomeFlow(product, SMALL_PROPERTY_MAX_ROOMS + 1).map((s) => s.key);
  const theirs = new Set(welcomeFlow(product, rooms).map((s) => s.key));
  return full.filter((k) => !theirs.has(k));
}

/** 0-based index of a step, or -1 — so a URL naming an unknown step can be handled, not crash. */
export function stepIndex(steps: WelcomeStep[], key: string): number {
  return steps.findIndex((s) => s.key === key);
}

/** Total physical rooms across the room types — the number the branch and the pricing tier share. */
export function totalRooms(roomTypes: { totalRooms: number }[]): number {
  return roomTypes.reduce((n, r) => n + (r.totalRooms || 0), 0);
}
