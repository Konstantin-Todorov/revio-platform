/**
 * The first-run flow — which screens a hotel sees before it starts trading, and in what order.
 *
 * Separate from `setup.ts` on purpose. That module answers *"what is still missing"* and drives a
 * checklist an established hotel may return to for months. This one answers *"what do we walk them
 * through on day one"*, which is a different question with a different shape: it is finite, ordered,
 * full-screen, and it ends.
 *
 * ## It branches on what already exists, not just on size
 *
 * The flow takes `WelcomeFacts` rather than a room count because the most important thing about a
 * hotel's second onboarding is that most of it has already happened. A hotel that runs RevioLink and
 * adds RevioCRS already has its property, room types, prices and branding **in the shared core** —
 * not copied there, the same rows. Asking for them again would make the platform's central claim
 * ("buy one, add the others, no migration") look false at the exact moment it is most persuasive.
 *
 * So a step whose data is already satisfied *and* shared with a product they already run is dropped
 * from the flow and reported on one opening screen instead. The second product's setup is two or
 * three screens. That screen is not a courtesy — it is the demonstration.
 *
 * ⚠️ A step is only inherited when **another product they run shares it**. Satisfied-but-not-shared
 * still gets asked: the screen simply arrives pre-filled. We must never silently skip a question on
 * the grounds that a value exists, because the value may be a provisioning default nobody has read.
 *
 * ## The size branch
 *
 * A 12-room guesthouse and a 120-room hotel are not the same customer. The owner of the first is also
 * the receptionist and the person who will type in the prices; the second has someone whose job is
 * distribution. Small properties skip the one step whose default is genuinely safe — staff, because
 * at that size the owner IS the staff.
 *
 * ⚠️ **Money and legal fields are asked at every size.** Taxes and invoicing identity were briefly
 * treated as a convenience default for small properties, and that was wrong by this project's own
 * rule: a default nobody corrects on a *money* field is money quietly decided by us. A guesthouse
 * still owes VAT, and a wrong rate is discovered on a document a guest has already been given.
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
 *
 * ## Deliberately not here
 *
 * **The RevioDirect booking address.** `publicSlug` is permanent once issued — it ends up on printed
 * QR codes and in Instagram bios — and switching the page on publishes photos and prices nobody has
 * reviewed. It stays in RevioCRS → Booking Engine, where the hotel arrives having already seen its
 * own rooms. The `brand` step still reaches it: `bookingBrandColor` is null-inherits-email, so one
 * answer here brands the booking page without onboarding ever mentioning it.
 *
 * **Cancellation policy.** `CancellationPolicy` is currently a label (name, code, description) with
 * no terms attached, so a first-run screen for it would collect a string that changes nothing. It
 * belongs in Rooms & Rates on the day that model grows real rules.
 */

import type { ProductName } from "./setup.js";

export type WelcomeStepKey =
  | "shared"
  | "property"
  | "rooms"
  | "units"
  | "prices"
  | "brand"
  | "taxes"
  | "delivery"
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
 * What is already true about this hotel, as the flow needs to know it.
 *
 * Every field is a fact about the **shared core**, which is what makes one definition serve three
 * products: the same `hasRoomTypes` that lets RevioCRS skip a screen is the row RevioLink created.
 */
export interface WelcomeFacts {
  /** Physical rooms across all room types — the size branch and the pricing tier share this number. */
  rooms: number;
  /** Address and contact details are filled in, beyond the name the operator typed. */
  hasPropertyDetails: boolean;
  hasRoomTypes: boolean;
  /** Physical rooms exist as PMS units — 101, 102. Never shared: no other product has units. */
  hasUnits: boolean;
  /** At least one price exists for at least one date. */
  hasRates: boolean;
  /** Guest-facing branding is set — sender name or colour. */
  hasBrand: boolean;
  /** VAT / city tax configured. */
  hasTaxes: boolean;
  /** The issuer identity a legal invoice needs: name, VAT id, address. */
  hasInvoiceIdentity: boolean;
  /** Somewhere for channel bookings to be emailed. */
  hasReservationDelivery: boolean;
  /** Staff accounts beyond the single Owner the operator created. */
  hasStaff: boolean;
  /** The OTHER Revio products this hotel runs. Empty on a first onboarding. */
  alsoRuns: ProductName[];
}

/** A hotel at the very beginning — nothing configured, nothing else owned. */
export function emptyFacts(rooms = 0): WelcomeFacts {
  return {
    rooms,
    hasPropertyDetails: false,
    hasRoomTypes: false,
    hasUnits: false,
    hasRates: false,
    hasBrand: false,
    hasTaxes: false,
    hasInvoiceIdentity: false,
    hasReservationDelivery: false,
    hasStaff: false,
    alsoRuns: [],
  };
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
  /**
   * How this step is named once it is *done*, on the inherited summary.
   *
   * `title` is phrased as a question or an instruction because that is what a screen asking for
   * something should say. Listed under "already done", the same words read wrong — "What do you
   * sell? · Already set up" is a question answered with a non-answer. So the summary uses a noun.
   */
  doneTitle?: string;
  /** Left out for a small property — the default is safe, reversible, and stated at the end. */
  askOnlyWhenLarge?: boolean;
  /** True once this step's data exists. Only ever skips the step when `sharedWith` also matches. */
  satisfied: (f: WelcomeFacts) => boolean;
  /**
   * The products that read and write this same data. A step is inherited — dropped from the flow and
   * named on the opening screen — only when it is satisfied AND one of these is a product they run.
   */
  sharedWith?: ProductName[];
  /** Drop the step entirely for this hotel, regardless of whether it is done. */
  omitWhen?: (f: WelcomeFacts) => boolean;
}

const ALL: ProductName[] = ["RevioLink", "RevioCRS", "RevioPMS"];

/**
 * Grouped on purpose. Name, address, contact and times are one thought — "who and where are you" —
 * and the address and contact email are not cosmetic: they are printed on every confirmation a guest
 * receives. Splitting them across four screens makes first-run feel long without making it clearer.
 */
const PROPERTY: StepDef = {
  key: "property",
  title: "Your property",
  doneTitle: "Your property details",
  lead: "Name, address and contact details. These appear on the confirmations your guests receive.",
  skippable: false,
  satisfied: (f) => f.hasPropertyDetails,
  sharedWith: ALL,
};

const ROOMS: StepDef = {
  key: "rooms",
  title: "What do you sell?",
  doneTitle: "Your room types",
  lead: "Your room types and how many of each. Everything else is built on this.",
  skippable: false,
  satisfied: (f) => f.hasRoomTypes,
  sharedWith: ALL,
};

/**
 * The PMS's own step, and the only one no other product can supply.
 *
 * A room type is a thing you sell; a unit is a door. Reception cannot check anyone in until the doors
 * exist, so this is never skipped and never inherited however many products the hotel runs.
 */
const UNITS: StepDef = {
  key: "units",
  title: "Your actual rooms",
  lead: "Room 101, 102, 201 — the doors housekeeping cleans and guests sleep behind.",
  skippable: false,
  satisfied: (f) => f.hasUnits,
};

const PRICES: StepDef = {
  key: "prices",
  title: "Set a starting price",
  doneTitle: "Your prices",
  lead: "One price to begin with — you can vary it by date once you are trading.",
  skippable: true,
  satisfied: (f) => f.hasRates,
  sharedWith: ["RevioLink", "RevioCRS"],
};

/**
 * Grouped with the issuer identity, because they are the same job: making an invoice correct.
 *
 * `invoiceIssuerName`, `invoiceVatId` and `invoiceAddress` are all nullable and were asked nowhere.
 * A hotel could finish setup, take a booking and issue a tax document with no VAT number on it —
 * which in most jurisdictions is not an invoice, it is a piece of paper.
 */
const TAXES: StepDef = {
  key: "taxes",
  title: "Tax and invoicing",
  doneTitle: "Your tax and invoicing setup",
  lead: "Your VAT rates and the legal details that must appear on every invoice you issue.",
  // Skippable — a hotel may not have its VAT number to hand on day one — but never silently defaulted.
  skippable: true,
  satisfied: (f) => f.hasTaxes && f.hasInvoiceIdentity,
  sharedWith: ["RevioCRS", "RevioPMS"],
};

/**
 * The one screen that gives something back rather than asking for something.
 *
 * A logo and a colour are the only settings in first-run whose result the hotel can *see*, and they
 * feed two guest-facing surfaces from one answer: every email, and — because `bookingBrandColor`
 * inherits from `emailBrandColor` when null — their own booking page. Buried in Settings, this is
 * the single most-missed configuration on the platform, and its absence is visible to guests.
 */
const BRAND: StepDef = {
  key: "brand",
  title: "How you look to guests",
  doneTitle: "Your logo and colour",
  lead: "Your logo and colour. Used on every email you send, and on your own booking page.",
  skippable: true,
  satisfied: (f) => f.hasBrand,
  sharedWith: ["RevioLink", "RevioCRS"],
};

/**
 * Where a channel booking goes when nothing else catches it.
 *
 * Only asked of a hotel running RevioLink **alone**. With a CRS or PMS the booking lands in a screen
 * somebody already looks at every morning; without one, an unset address means the reservation exists
 * in RevioLink and nowhere a human will see it. That is the difference between a missing setting and
 * a missed guest.
 */
const DELIVERY: StepDef = {
  key: "delivery",
  title: "Where your bookings go",
  lead: "Channel bookings are emailed here the moment they arrive.",
  skippable: true,
  satisfied: (f) => f.hasReservationDelivery,
  omitWhen: (f) => f.alsoRuns.includes("RevioCRS") || f.alsoRuns.includes("RevioPMS"),
};

const TEAM: StepDef = {
  key: "team",
  title: "Add your team",
  doneTitle: "Your team's logins",
  lead: "Everyone gets their own login. Nobody shares a password.",
  skippable: true,
  askOnlyWhenLarge: true,
  satisfied: (f) => f.hasStaff,
  // One identity across the platform: staff invited from RevioLink sign in to RevioCRS unchanged.
  sharedWith: ALL,
};

const GOLIVE = (product: ProductName): StepDef => ({
  key: "golive",
  title: product === "RevioLink" ? "Put your rooms on sale" : "You're ready",
  lead:
    product === "RevioLink"
      ? "Connect a channel and start sending availability. Nothing has left Revio until you do."
      : "Everything is in place. Here is what we set up for you.",
  skippable: false,
  satisfied: () => false, // never inherited, never pre-satisfied — somebody has to choose
});

/**
 * The opening screen of a second or third onboarding, and the whole argument for this platform.
 *
 * Only appears when something really was inherited, so a first onboarding never sees it — and it
 * lists what carried over by name rather than claiming it generically, because a hotel that has just
 * paid for another product is entitled to check.
 */
const SHARED = (product: ProductName): StepDef => ({
  key: "shared",
  title: "Most of this is already done",
  lead: `${product} runs on the same records as the products you already use. Nothing here was copied — it is the same data, so it can never drift apart.`,
  skippable: false,
  satisfied: () => false,
});

/** Every step a product could ask, before size or inheritance is applied. */
function productSteps(product: ProductName): StepDef[] {
  if (product === "RevioPMS") {
    // The PMS sells nothing and shows a guest nothing: no price, no branding. It needs the physical
    // rooms and the tax setup its invoices depend on.
    return [PROPERTY, ROOMS, UNITS, TAXES, TEAM];
  }
  return [
    PROPERTY,
    ROOMS,
    PRICES,
    // Only the products that issue an invoice ask about tax. A channel manager never does.
    ...(product === "RevioCRS" ? [TAXES] : []),
    BRAND,
    // Only RevioLink receives bookings from outside the platform.
    ...(product === "RevioLink" ? [DELIVERY] : []),
    TEAM,
  ];
}

/** True when this step's data is already in the core AND a product they run shares it. */
function isInherited(def: StepDef, f: WelcomeFacts): boolean {
  if (!def.sharedWith || !def.satisfied(f)) return false;
  return f.alsoRuns.some((p) => def.sharedWith!.includes(p));
}

/** What carried over from the products they already run — for the opening screen to list. */
export function inheritedSteps(
  product: ProductName,
  facts: WelcomeFacts,
): { key: WelcomeStepKey; title: string; sharedWith: ProductName[] }[] {
  return productSteps(product)
    .filter((d) => !d.omitWhen?.(facts) && isInherited(d, facts))
    .map((d) => ({
      key: d.key,
      title: d.doneTitle ?? d.title,
      sharedWith: facts.alsoRuns.filter((p) => d.sharedWith!.includes(p)),
    }));
}

/** The screens for a product, in order, for this hotel as it actually stands today. */
export function welcomeFlow(product: ProductName, facts: WelcomeFacts): WelcomeStep[] {
  const small = isSmallProperty(facts.rooms);
  const inherited = new Set(inheritedSteps(product, facts).map((s) => s.key));

  const asked = productSteps(product).filter(
    (d) => !d.omitWhen?.(facts) && !inherited.has(d.key) && !(small && d.askOnlyWhenLarge),
  );

  const defs: StepDef[] = [
    ...(inherited.size > 0 ? [SHARED(product)] : []),
    ...asked,
    GOLIVE(product),
  ];

  return defs.map(
    ({ doneTitle: _d, askOnlyWhenLarge: _a, satisfied: _s, sharedWith: _w, omitWhen: _o, ...step }) => step,
  );
}

/** Which defaults were accepted on the hotel's behalf, to be stated plainly on the final screen. */
export function skippedForSize(product: ProductName, facts: WelcomeFacts): WelcomeStepKey[] {
  if (!isSmallProperty(facts.rooms)) return [];
  return productSteps(product)
    .filter((d) => d.askOnlyWhenLarge && !d.omitWhen?.(facts) && !isInherited(d, facts))
    .map((d) => d.key);
}

/** 0-based index of a step, or -1 — so a URL naming an unknown step can be handled, not crash. */
export function stepIndex(steps: WelcomeStep[], key: string): number {
  return steps.findIndex((s) => s.key === key);
}

/**
 * The step before this one, or null on the first.
 *
 * First-run is a sequence somebody is typing into, which means somebody will mistype. Without a way
 * back, a wrong room count is only fixable by abandoning setup and hunting for the screen that owns
 * it — so "no back button" is not a simplification, it is a trap.
 */
export function previousStep(steps: WelcomeStep[], key: string): WelcomeStep | null {
  const i = stepIndex(steps, key);
  return i > 0 ? steps[i - 1]! : null;
}

/** The step after this one, or null on the last. */
export function nextStep(steps: WelcomeStep[], key: string): WelcomeStep | null {
  const i = stepIndex(steps, key);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1]! : null;
}

/** Total physical rooms across the room types — the number the branch and the pricing tier share. */
export function totalRooms(roomTypes: { totalRooms: number }[]): number {
  return roomTypes.reduce((n, r) => n + (r.totalRooms || 0), 0);
}
