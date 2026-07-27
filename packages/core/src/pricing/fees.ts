/**
 * Taxes and fees on a stay — the ONE implementation.
 *
 * This exists because two places need the same answer and must never disagree: the booking engine
 * quotes a guest a total before they book, and the PMS folio charges them after they arrive. If
 * those two numbers are computed by different code, they eventually differ — and a guest who is
 * quoted 240 and billed 252 is the single most-cited reason people abandon hotel bookings, now
 * happening *after* they trusted us. So the quote and the folio call this same function.
 *
 * Pure: no database, no Prisma. Callers pass the fee rows they loaded.
 */

export interface StayFee {
  name: string;
  /** "percent" of accommodation, or "fixed" multiplied by its basis. */
  type: string;
  pct?: number | null;
  amountMinor?: number | null;
  /** per_room | per_person | per_night | per_stay */
  basis: string;
  /** "included" fees are already inside the rate and are never added on top. */
  inclusion?: string;
  active?: boolean;
}

export interface StayShape {
  /** Accommodation for the whole stay, in minor units — what percent fees are charged on. */
  accommodationMinor: number;
  nights: number;
  rooms: number;
  guests: number;
}

export interface ChargeLine {
  name: string;
  amountMinor: number;
  /** "tax" for percentage-based, "fee" for fixed — matches the folio's line kinds. */
  kind: "tax" | "fee";
}

export interface StayCharges {
  accommodationMinor: number;
  /** Only the fees actually added on top; included and suppressed ones never appear. */
  lines: ChargeLine[];
  extrasMinor: number;
  /** What the guest actually pays. This is the number quoted AND the number billed. */
  totalMinor: number;
}

/** City tax is identified by name — the same rule the PMS folio uses to suppress it. */
export function isCityTax(name: string): boolean {
  return /city\s*tax/i.test(name);
}

/**
 * One fee's amount for a stay.
 *
 * Percentage fees apply to accommodation only — never to other fees, which would compound tax on
 * tax. Fixed fees multiply by their basis.
 */
export function feeAmount(fee: StayFee, stay: StayShape): number {
  if (fee.type === "percent") {
    return fee.pct ? Math.round((stay.accommodationMinor * fee.pct) / 100) : 0;
  }
  const unit = fee.amountMinor ?? 0;
  const multiplier =
    fee.basis === "per_night" ? stay.nights
    : fee.basis === "per_room" ? stay.rooms
    : fee.basis === "per_person" ? stay.guests
    : 1; // per_stay
  return unit * multiplier;
}

/**
 * Everything the guest owes for a stay.
 *
 * `cityTaxIncluded` reflects the property's city-tax mode: when the hotel has folded city tax into
 * its rate, posting it again here would charge the guest twice. That decision belongs to the CRS and
 * is honoured identically by the quote and the folio.
 */
export function computeStayCharges(args: {
  stay: StayShape;
  fees: readonly StayFee[];
  cityTaxIncluded?: boolean;
  /** Optional add-ons the guest chose, already priced. */
  extrasMinor?: number;
}): StayCharges {
  const { stay, fees, cityTaxIncluded = false, extrasMinor = 0 } = args;

  const lines: ChargeLine[] = [];
  for (const fee of fees) {
    if (fee.active === false) continue;
    // An "included" fee is already inside the rate — adding it would double-charge.
    if ((fee.inclusion ?? "excluded") !== "excluded") continue;
    if (cityTaxIncluded && isCityTax(fee.name)) continue;

    const amountMinor = feeAmount(fee, stay);
    if (amountMinor <= 0) continue;
    lines.push({ name: fee.name, amountMinor, kind: fee.type === "percent" ? "tax" : "fee" });
  }

  const feesTotal = lines.reduce((sum, l) => sum + l.amountMinor, 0);
  return {
    accommodationMinor: stay.accommodationMinor,
    lines,
    extrasMinor,
    totalMinor: stay.accommodationMinor + feesTotal + extrasMinor,
  };
}
