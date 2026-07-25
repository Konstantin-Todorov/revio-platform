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
 * the three products from disagreeing about whether a hotel is ready.
 */

export interface SetupStep {
  key: string;
  /** Imperative, in the hotel's language — "Add your room types", not "roomTypes > 0". */
  title: string;
  /** Why it matters / what it unlocks. One sentence. */
  body: string;
  href: string;
  cta: string;
  done: boolean;
}

export interface SetupProgress {
  steps: SetupStep[];
  done: number;
  total: number;
  /** True once every step is satisfied — the checklist then disappears for good. */
  complete: boolean;
  /** The first unfinished step: what the hotel should do right now. */
  next: SetupStep | null;
}

function progress(steps: SetupStep[]): SetupProgress {
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, complete: done === steps.length, next: steps.find((s) => !s.done) ?? null };
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
}

/** RevioLink: the hotel is ready when its inventory reaches the OTAs. */
export function reviolinkSetup(f: SetupFacts): SetupProgress {
  return progress([
    {
      key: "room-types",
      title: "Add your room types",
      body: "The rooms you sell — Double, Suite, and how many of each you have.",
      href: "/rooms-rates",
      cta: "Add room types",
      done: f.roomTypes > 0,
    },
    {
      key: "rates",
      title: "Set your rates",
      body: "Price the dates you want to sell. Bulk Rates fills a whole season in one go.",
      href: "/bulk-update",
      cta: "Set rates",
      done: f.hasRates,
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
  return progress([
    {
      key: "room-types",
      title: "Add your room types",
      body: "The rooms you sell and how many of each — the basis of every availability check.",
      href: "/rooms-rates",
      cta: "Add room types",
      done: f.roomTypes > 0,
    },
    {
      key: "rates",
      title: "Set your rates",
      body: "Price your dates so the availability search can quote a stay.",
      href: "/bulk",
      cta: "Set rates",
      done: f.hasRates,
    },
    {
      key: "taxes",
      title: "Add your taxes & fees",
      body: "VAT, city tax and any fixed fees, so every quote and folio totals correctly.",
      href: "/settings",
      cta: "Open settings",
      done: f.hasTaxes,
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
  return progress([
    {
      key: "room-types",
      title: "Add your room types",
      body: "Defined once for the whole platform, in RevioLink or RevioCRS under Rooms & Rates.",
      href: "/rooms",
      cta: "See rooms",
      done: f.roomTypes > 0,
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
