/**
 * First-run setup — what "this hotel is ready to trade" means, per product.
 *
 * A brand-new hotel is provisioned with a property, an Owner and one base rate plan; everything else
 * it configures itself. Until that configuration exists, a dashboard full of zeros tells the hotel
 * nothing and a row of green "healthy" pills is an outright lie. So each product asks this module
 * what is still missing and shows the answer instead.
 *
 * The step LISTS live here rather than in the apps because "set up" is a platform-level fact: room
 * types created in RevioLink are the same records RevioCRS and RevioPMS need. One definition keeps
 * the three products from disagreeing about whether a hotel is ready — and lets the Operator console
 * show a client exactly what that client sees, rather than a second opinion.
 *
 * ## Two things this file does on purpose
 *
 * **Nobody starts at zero.** The first step is already ticked, because it is already true: the
 * operator created the tenant, the owner, the property and a base rate plan before the hotel ever
 * signed in. Counting work that really happened is not a motivational trick, it is arithmetic we
 * were previously getting wrong — `0 of 4` described a hotel that was demonstrably further along
 * than that.
 *
 * **A shared step says that it is shared.** When a hotel that runs RevioLink opens RevioCRS, its
 * room types and rates are already there — not copied, the same records. Ticking them silently
 * wastes the single best moment to show what one shared core buys.
 *
 * ⚠️ It says *shared with*, never *set up in*. We do not record which product created a room type,
 * so naming an author is a guess — and with all three products owned it is a guess that contradicts
 * itself, since each product would credit a different sibling for the same row. What IS provable
 * from the data model is that the record is one record, common to every product they run, and that
 * they will never type it twice. That is also the claim worth making.
 */

/** The products a hotel can run, by the name it sees on screen. */
export type ProductName = "RevioLink" | "RevioCRS" | "RevioPMS";

/**
 * The value each product writes into `Property.setupCompleted`.
 *
 * It lives here because it was previously written in two vocabularies: the dashboard checklists
 * pushed `"cm"`, and the welcome flow pushed `"RevioLink"`. One column, two names for one fact, so
 * finishing the guided setup did not stop the checklist from asking again. A hotel's own record of
 * "I have done this" is not a place for two opinions.
 */
export const SETUP_KEY: Record<ProductName, string> = {
  RevioLink: "cm",
  RevioCRS: "crs",
  RevioPMS: "pms",
};

/**
 * Has this property finished first-run setup for this product?
 *
 * Accepts the product name as well as the key, because the short-lived earlier build wrote
 * `"RevioLink"` into production rows. Standardising the constant must never cost a hotel that
 * already finished the flow a second trip through it.
 */
export function hasFinishedSetup(setupCompleted: string[], product: ProductName): boolean {
  return setupCompleted.includes(SETUP_KEY[product]) || setupCompleted.includes(product);
}

export interface SetupStep {
  key: string;
  /** Imperative, in the hotel's language — "Add your room types", not "roomTypes > 0". */
  title: string;
  /** Why it matters / what it unlocks. One sentence. */
  body: string;
  href: string;
  cta: string;
  done: boolean;
  /**
   * The other Revio products this step's data is shared with, when the hotel runs any.
   *
   * Only set when the hotel actually runs them — a CRS-only hotel created its own room types, and
   * mentioning RevioLink would be talking about software it has never seen. Never an authorship
   * claim: see the note at the top of this file.
   */
  sharedWith?: ProductName[];
  /**
   * True for work that was done for them rather than by them — the provisioning the operator did.
   * Rendered differently from a step they completed, because claiming their credit is patronising.
   */
  providedForYou?: boolean;
}

export interface SetupProgress {
  steps: SetupStep[];
  done: number;
  total: number;
  /** True once every step is satisfied — the checklist then disappears for good. */
  complete: boolean;
  /** The first unfinished step: what the hotel should do right now. */
  next: SetupStep | null;
  /** Steps already satisfied by data shared with another product they run. */
  shared: SetupStep[];
}

function progress(steps: SetupStep[]): SetupProgress {
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    total: steps.length,
    complete: done === steps.length,
    next: steps.find((s) => !s.done) ?? null,
    shared: steps.filter((s) => s.sharedWith !== undefined),
  };
}

/** Facts every product reads from the shared core records. */
export interface SetupFacts {
  /** Room types on the property (created in RevioLink or RevioCRS — the same records). */
  roomTypes: number;
  /** Rate plans on the property. A new hotel starts with one, so this is rarely the blocker. */
  ratePlans: number;
  /** At least one price exists for at least one date — otherwise there is nothing to sell. */
  hasRates: boolean;
  /** Connected distribution channels (RevioLink). */
  channels: number;
  /** Every connected channel's room types and rate plans are mapped to the OTA's own IDs. */
  mappingComplete: boolean;
  /** Physical rooms (RevioPMS units). */
  units: number;
  /** Staff accounts beyond the single Owner the operator created. */
  staff: number;
  /** Taxes / fees configured — a Bulgarian property needs VAT + city tax before it invoices. */
  hasTaxes: boolean;
  /** Anything sellable from an outlet (minibar, bar, spa). */
  catalogItems: number;
  /** Any reservation at all has been taken. */
  reservations: number;
  /**
   * The OTHER Revio products this hotel runs. Lets a shared step name where it was already done.
   * Omit (or leave empty) and shared steps simply read as done, which is correct for a hotel that
   * only ever bought one product.
   */
  alsoRuns?: ProductName[];
}

/**
 * Which of the hotel's other products share this step's data — or undefined when none do.
 *
 * Returns every match rather than the first, because "shared with RevioLink and RevioPMS" is true
 * while "set up in RevioLink" is unknowable. Undefined (not an empty array) when there is nothing to
 * say, so the key is omitted entirely.
 */
function sharedWith(f: SetupFacts, satisfied: boolean, candidates: ProductName[]): ProductName[] | undefined {
  if (!satisfied) return undefined;
  const matches = (f.alsoRuns ?? []).filter((p) => candidates.includes(p));
  return matches.length > 0 ? matches : undefined;
}

/**
 * The step that is already true before a hotel signs in for the first time.
 *
 * Shared by all three products verbatim, because it is one fact about the account rather than three.
 */
function propertyStep(href: string): SetupStep {
  return {
    key: "property",
    title: "Your property is set up",
    body: "Created with your account, along with a starting rate plan.",
    href,
    cta: "Review",
    done: true,
    providedForYou: true,
  };
}

/** RevioLink: the hotel is ready when its inventory reaches the OTAs. */
export function reviolinkSetup(f: SetupFacts): SetupProgress {
  const roomsDone = f.roomTypes > 0;
  const ratesDone = f.hasRates;

  return progress([
    propertyStep("/settings"),
    {
      key: "room-types",
      title: "Add your room types",
      body: "The rooms you sell — Double, Suite, and how many of each you have.",
      href: "/rooms-rates",
      cta: "Add room types",
      done: roomsDone,
      ...maybe("sharedWith", sharedWith(f, roomsDone, ["RevioCRS", "RevioPMS"])),
    },
    {
      key: "rates",
      title: "Set your rates",
      body: "Price the dates you want to sell. Bulk Rates fills a whole season in one go.",
      href: "/bulk-update",
      cta: "Set rates",
      done: ratesDone,
      ...maybe("sharedWith", sharedWith(f, ratesDone, ["RevioCRS"])),
    },
    {
      key: "channels",
      title: "Connect a channel",
      body: "Booking.com, Expedia and the rest — this is what puts your rooms on sale.",
      href: "/channels",
      cta: "Connect a channel",
      done: f.channels > 0,
    },
    {
      key: "mapping",
      title: "Map your products",
      body: "Match each room type and rate plan to the channel's own listing so updates land correctly.",
      href: "/mapping",
      cta: "Open mapping",
      done: f.channels > 0 && f.mappingComplete,
    },
  ]);
}

/** RevioCRS: the hotel is ready when it can take and invoice a booking. */
export function reviocrsSetup(f: SetupFacts): SetupProgress {
  const roomsDone = f.roomTypes > 0;
  const ratesDone = f.hasRates;

  return progress([
    propertyStep("/settings"),
    {
      key: "room-types",
      title: "Add your room types",
      body: "The rooms you sell and how many of each — the basis of every availability check.",
      href: "/rooms-rates",
      cta: "Add room types",
      done: roomsDone,
      ...maybe("sharedWith", sharedWith(f, roomsDone, ["RevioLink", "RevioPMS"])),
    },
    {
      key: "rates",
      title: "Set your rates",
      body: "Price your dates so the availability search can quote a stay.",
      href: "/bulk",
      cta: "Set rates",
      done: ratesDone,
      ...maybe("sharedWith", sharedWith(f, ratesDone, ["RevioLink"])),
    },
    {
      key: "taxes",
      title: "Add your taxes & fees",
      body: "VAT, city tax and any fixed fees, so every quote and folio totals correctly.",
      href: "/settings",
      cta: "Open settings",
      done: f.hasTaxes,
      ...maybe("sharedWith", sharedWith(f, f.hasTaxes, ["RevioPMS"])),
    },
    {
      key: "first-reservation",
      title: "Take your first reservation",
      body: "Search availability, hold the room, confirm — the whole booking flow in one screen.",
      href: "/reservations/new",
      cta: "New reservation",
      done: f.reservations > 0,
    },
  ]);
}

/** RevioPMS: the hotel is ready when reception can check a guest into a real room. */
export function reviopmsSetup(f: SetupFacts): SetupProgress {
  const roomsDone = f.roomTypes > 0;

  return progress([
    propertyStep("/configuration"),
    {
      key: "room-types",
      title: "Add your room types",
      body: "Defined once for the whole platform, in RevioLink or RevioCRS under Rooms & Rates.",
      href: "/rooms",
      cta: "See rooms",
      done: roomsDone,
      ...maybe("sharedWith", sharedWith(f, roomsDone, ["RevioLink", "RevioCRS"])),
    },
    {
      key: "units",
      title: "Add your physical rooms",
      body: "Room 101, 102, 201 — the actual doors housekeeping cleans and guests sleep behind.",
      href: "/rooms",
      cta: "Add rooms",
      done: f.units > 0,
    },
    {
      key: "configuration",
      title: "Check your property setup",
      body: "Check-out time, VAT and city tax, and whether cleaned rooms need inspecting.",
      href: "/configuration",
      cta: "Open configuration",
      done: f.hasTaxes,
      ...maybe("sharedWith", sharedWith(f, f.hasTaxes, ["RevioCRS"])),
    },
    {
      key: "staff",
      title: "Add your team",
      body: "Reception, housekeeping and maintenance each see only the screens they need.",
      href: "/users",
      cta: "Add staff",
      done: f.staff > 1,
    },
  ]);
}

/**
 * Spread an optional property only when it has a value.
 *
 * `exactOptionalPropertyTypes` is on, so `{ sharedWith: undefined }` is not the same as omitting the
 * key — and a present-but-undefined `sharedWith` would make `shared` count steps that share nothing.
 */
function maybe<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
