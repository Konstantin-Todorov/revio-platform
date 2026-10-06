/**
 * Who is staying, the way a hotel prices and fits them — from the adults and the children's AGES the
 * guest typed, never from a single "guests" number.
 *
 * A booking engine that asks only "how many guests" either sells a family of four a room for two, or
 * charges an infant as an adult. Every engine guests know asks for the children's ages for exactly
 * this, and the hotel's age bands (`PropertyDefaults.ageInfantMax` / `ageChildMax`) decide the rest:
 *
 *  - an **infant** (≤ infant max) sleeps in a cot: not counted against the room's capacity, charged the
 *    plan's infant fee (usually nothing);
 *  - a **child** (≤ child max) takes a bed: counted against capacity, charged the plan's child fee
 *    per night on top of the adults' price;
 *  - anyone older is priced and taxed as an **adult** — a 15-year-old is not a child to a hotel whose
 *    bands end at 11.
 *
 * Adult occupancy and the children axis are deliberately separate (OBP §6.9): the per-occupancy
 * price is looked up for the adults, and children are added on top, never folded in.
 */
export interface AgeBands {
  infantMax: number;
  childMax: number;
}

export const DEFAULT_AGE_BANDS: AgeBands = { infantMax: 2, childMax: 11 };
export const MAX_CHILDREN = 6;

export interface Party {
  /** Adults as typed. */
  adults: number;
  /** Adults for PRICING and tourist tax: the adults plus children older than the child band. */
  pricedAdults: number;
  /** Children in the child band — a bed each, the plan's child fee each night. */
  children: number;
  /** Infants — a cot, not counted against the room's capacity. */
  infants: number;
  /** Beds needed: what the room's `maxGuests` must hold. */
  occupancy: number;
  /** The ages as given. */
  childAges: number[];
  /**
   * Ages of the children and infants only — what a stay STORES beside `pricedAdults`. Anyone older
   * is already counted as an adult there, so storing their age too would count them twice when the
   * stay is re-priced (a change of dates).
   */
  youngAges: number[];
}

export function partyOf(adults: number, childAges: readonly number[] = [], bands: AgeBands = DEFAULT_AGE_BANDS): Party {
  let older = 0, children = 0, infants = 0;
  for (const age of childAges) {
    if (age <= bands.infantMax) infants++;
    else if (age <= bands.childMax) children++;
    else older++;
  }
  const pricedAdults = adults + older;
  return {
    adults, pricedAdults, children, infants, occupancy: pricedAdults + children,
    childAges: [...childAges], youngAges: childAges.filter((a) => a <= bands.childMax),
  };
}

/** Everyone in the room — adults, children and infants. What the guest register lists, and what the tourist tax counts. */
export function personsOf(party: Pick<Party, "adults" | "childAges">): number {
  return party.adults + party.childAges.length;
}

/** The children's extra for ONE night on a plan: child fee × children + infant fee × infants. */
export function childrenNightMinor(party: Party, fees: { childrenFeeMinor: number; infantFeeMinor: number }): number {
  return party.children * Math.max(0, fees.childrenFeeMinor) + party.infants * Math.max(0, fees.infantFeeMinor);
}

/** `"4,7"` → [4, 7]; anything that is not a whole age 0–17 is dropped, at most MAX_CHILDREN. */
export function parseChildAges(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return raw.split(",").map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17)
    .slice(0, MAX_CHILDREN);
}

/**
 * Several rooms in one search — each with its own party, the way every booking site asks.
 *
 * In a URL as `rooms=2-5.1|2`: rooms separated by `|`, each "adults" optionally followed by
 * `-` and the children's ages joined by `.`. One room keeps the plain `guests`/`ages` parameters,
 * so every link already in an email or a bookmark still works.
 */
export interface RoomParty {
  adults: number;
  childAges: number[];
}

export const MAX_ROOMS = 5;

export function parseRoomParties(raw: string | null | undefined): RoomParty[] {
  if (!raw) return [];
  return raw.split("|").slice(0, MAX_ROOMS).map((part) => {
    const [a, kids] = part.split("-");
    const adults = Number(a);
    return {
      adults: Number.isInteger(adults) && adults >= 1 && adults <= 10 ? adults : 2,
      childAges: parseChildAges((kids ?? "").replace(/\./g, ",")),
    };
  });
}

export function serializeRoomParties(rooms: readonly RoomParty[]): string {
  return rooms.map((r) => (r.childAges.length ? `${r.adults}-${r.childAges.join(".")}` : String(r.adults))).join("|");
}

/** A chosen room for one slot of a multi-room search: `roomTypeId~ratePlanId`, joined by `,`. */
export interface RoomPick { roomTypeId: string; ratePlanId: string }

export function parseRoomPicks(raw: string | null | undefined): RoomPick[] {
  if (!raw) return [];
  return raw.split(",").slice(0, MAX_ROOMS).map((p) => {
    const [roomTypeId, ratePlanId] = p.split("~");
    return { roomTypeId: roomTypeId ?? "", ratePlanId: ratePlanId ?? "" };
  }).filter((p) => /^[a-z0-9]{6,40}$/i.test(p.roomTypeId) && /^[a-z0-9]{6,40}$/i.test(p.ratePlanId));
}

export function serializeRoomPicks(picks: readonly RoomPick[]): string {
  return picks.map((p) => `${p.roomTypeId}~${p.ratePlanId}`).join(",");
}
