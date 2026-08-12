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
 * **A step another product already satisfied says so.** When a hotel that runs RevioLink opens
 * RevioCRS, its room types and rates are already there — not copied, the same records. Ticking them
 * silently wastes the single best moment to show what one shared core buys: `inheritedFrom` lets the
 * screen say *"already set up in RevioLink"*, which is the zero-migration promise arriving as a
 * fact rather than a claim on a pricing page.
 */

/** The products a hotel can run, by the name it sees on screen. */
export type ProductName = "RevioLink" | "RevioCRS" | "RevioPMS";

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
   * Which other Revio product already satisfied this step, when one did.
   *
   * Only set when the hotel actually runs that product — a CRS-only hotel created its own room
   * types, and telling it they came from RevioLink would be a lie about software it has never seen.
   */
  inheritedFrom?: ProductName;
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
  /** Steps they did not have to do because another product had already done them. */
  inherited: SetupStep[];
}

function progress(steps: SetupStep[]): SetupProgress {
  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    done,
    total: steps.length,
    complete: done === steps.length,
    next: steps.find((s) => !s.done) ?? null,
    inherited: steps.filter((s) => s.inheritedFrom !== undefined),
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

/** Did another product the hotel runs already do this? Returns the crediting product, or undefined. */
function creditTo(f: SetupFacts, satisfied: boolean, candidates: ProductName[]): ProductName | undefined {
  if (!satisfied) return undefined;
  return (f.alsoRuns ?? []).find((p) => candidates.includes(p));
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
      ...maybe("inheritedFrom", creditTo(f, roomsDone, ["RevioCRS", "RevioPMS"])),
    },
    {
      key: "rates",
      title: "Set your rates",
      body: "Price the dates you want to sell. Bulk Rates fills a whole season in one go.",
      href: "/bulk-update",
      cta: "Set rates",
      done: ratesDone,
      ...maybe("inheritedFrom", creditTo(f, ratesDone, ["RevioCRS"])),
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
      ...maybe("inheritedFrom", creditTo(f, roomsDone, ["RevioLink", "RevioPMS"])),
    },
    {
      key: "rates",
      title: "Set your rates",
      body: "Price your dates so the availability search can quote a stay.",
      href: "/bulk",
      cta: "Set rates",
      done: ratesDone,
      ...maybe("inheritedFrom", creditTo(f, ratesDone, ["RevioLink"])),
    },
    {
      key: "taxes",
      title: "Add your taxes & fees",
      body: "VAT, city tax and any fixed fees, so every quote and folio totals correctly.",
      href: "/settings",
      cta: "Open settings",
      done: f.hasTaxes,
      ...maybe("inheritedFrom", creditTo(f, f.hasTaxes, ["RevioPMS"])),
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
      ...maybe("inheritedFrom", creditTo(f, roomsDone, ["RevioLink", "RevioCRS"])),
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
      ...maybe("inheritedFrom", creditTo(f, f.hasTaxes, ["RevioCRS"])),
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
 * `exactOptionalPropertyTypes` is on, so `{ inheritedFrom: undefined }` is not the same as omitting
 * the key — and a present-but-undefined `inheritedFrom` would make `inherited` count steps nobody
 * inherited.
 */
function maybe<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
