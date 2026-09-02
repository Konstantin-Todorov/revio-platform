/**
 * Products that have never reached the channel at all.
 *
 * ## The gap this exists to make visible
 *
 * `provisionChannexProperty` is the ONLY code that creates a room type or a rate plan on Channex,
 * and it is one-shot: it sends what exists at the moment it runs. Everything added afterwards —
 * the second room type a hotel adds in its first week, a new rate plan for a season — is created
 * locally, linked to every plan, made sellable on the booking engine, and **never told to Channex**.
 *
 * That alone is a bug. What makes it dangerous is how it reports.
 *
 * Every "unmapped products" counter on the dashboard and in the notification bell asks the mapping
 * tables for rows whose `status` is not `complete`. A product that was never sent has **no mapping
 * row at all**, so it matches no such query and adds nothing to the count. The hotel is shown
 * "all mapped", in green, while a room type it is actively selling is invisible to every OTA.
 *
 * > ⚠️ **A zero from success and a zero from silence must never render the same.** This module is
 * > that rule applied to structure: `incomplete` is a row that exists and is not finished;
 * > `neverSent` is the absence of a row, and only one of the two can be found by counting rows.
 *
 * ## Why it is pure
 *
 * The rules below are judgements that will be argued with once a hotel is on the phone — which
 * rate plans need their own Channex plan, whether an inactive room type counts, what an unscoped
 * plan covers. Those belong in a tested function, not spread across a Prisma query and some JSX.
 */

/** A room type as the mapping question sees it. */
export interface StructureRoomType {
  id: string;
  name: string;
  active: boolean;
}

/** A rate plan as the mapping question sees it. */
export interface StructureRatePlan {
  id: string;
  name: string;
  active: boolean;
  /** `manual` authors its own prices. Derived plans follow a parent and Channex never holds them. */
  priceLogic: string;
}

/** One product that has no counterpart on the channel. */
export interface MissingProduct {
  id: string;
  name: string;
  kind: "roomType" | "ratePlan";
}

export interface StructureGapResult {
  /** Local, sellable, and never sent to the channel — invisible to every OTA. */
  neverSent: MissingProduct[];
  /** True when the hotel is selling something no channel can see. */
  hasGap: boolean;
}

/**
 * Which active products have no mapping row on this channel at all.
 *
 * **Only `manual` rate plans are counted.** A derived plan takes its price from a parent and is
 * never created on Channex — provisioning skips them for the same reason, so counting them here
 * would invent a gap that cannot be closed and teach everyone to ignore this number.
 *
 * **Inactive products are not counted.** A deactivated room type is not being sold, so it reaching
 * no OTA is correct rather than a fault.
 */
export function structureGap(args: {
  roomTypes: readonly StructureRoomType[];
  ratePlans: readonly StructureRatePlan[];
  /** Existing room-type mapping rows — only the local id matters, status is a different question. */
  mappedRoomTypeIds: readonly string[];
  /** Existing rate-plan mapping rows, by local rate plan id. */
  mappedRatePlanIds: readonly string[];
}): StructureGapResult {
  const rooms = new Set(args.mappedRoomTypeIds);
  const plans = new Set(args.mappedRatePlanIds);

  const neverSent: MissingProduct[] = [];

  for (const rt of args.roomTypes) {
    if (!rt.active) continue;
    if (!rooms.has(rt.id)) neverSent.push({ id: rt.id, name: rt.name, kind: "roomType" });
  }
  for (const rp of args.ratePlans) {
    if (!rp.active || rp.priceLogic !== "manual") continue;
    if (!plans.has(rp.id)) neverSent.push({ id: rp.id, name: rp.name, kind: "ratePlan" });
  }

  return { neverSent, hasGap: neverSent.length > 0 };
}

/**
 * The sentence a hotelier reads. Names what is invisible and says what it means, because
 * "2 unmapped products" does not tell somebody their rooms are not on sale.
 */
export function describeStructureGap(r: StructureGapResult): string | null {
  if (!r.hasGap) return null;
  const names = r.neverSent.map((p) => p.name);
  const list = names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
  return `${list} ${r.neverSent.length === 1 ? "has" : "have"} never reached your channel manager, so no OTA can see ${r.neverSent.length === 1 ? "it" : "them"}.`;
}
