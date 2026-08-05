// Operator-side pricing model (what we charge hotels). Simple, transparent: a plan/tier base fee +
// a per-product module fee for each entitled product. Money is integer minor units (cents), EUR.

export type Entitlements = { channelManager: boolean; reservation: boolean; pms: boolean };

/** Plan tier base fee (room-count tier uplift). starter is the entry tier. */
export const PLAN_BASE_MINOR: Record<string, number> = { starter: 0, growth: 5000, scale: 15000, enterprise: 30000 };

/**
 * The plan a client's ROOM COUNT says they should be on.
 *
 * The tiering has been the stated model since the first architecture note — "CM priced by room-count
 * tier: 0–30, 31–50, 50–100" — but nothing ever computed it, so `plan` was whatever was typed at
 * onboarding and never moved again. A hotel that opened a second building stayed on Starter forever.
 *
 * That is the quietest revenue leak a vertical SaaS has: expansion that already happened, unbilled,
 * because nobody re-counted. We are the ones holding the room count, so we are the ones who can see
 * it drift — and a tier change is the easiest possible upsell conversation, because the customer has
 * already taken the value.
 */
export const ROOM_TIERS = [
  { plan: "starter", label: "0–30 rooms", maxRooms: 30 },
  { plan: "growth", label: "31–50 rooms", maxRooms: 50 },
  { plan: "scale", label: "51–100 rooms", maxRooms: 100 },
  { plan: "enterprise", label: "100+ rooms", maxRooms: Number.POSITIVE_INFINITY },
] as const;

export function tierForRooms(rooms: number): (typeof ROOM_TIERS)[number] {
  return ROOM_TIERS.find((t) => rooms <= t.maxRooms) ?? ROOM_TIERS[ROOM_TIERS.length - 1]!;
}

export interface TierDrift {
  currentPlan: string;
  correctPlan: string;
  rooms: number;
  /** Positive = we are under-billing them. Negative = they shrank and are over-paying. */
  monthlyDeltaMinor: number;
}

/**
 * Has the room count outgrown (or fallen behind) the plan being billed?
 *
 * Returns `null` when they match. Under-billing is revenue to collect; **over-billing is reported
 * just as plainly**, because a hotel that closed a wing and is still paying the bigger tier will
 * find out eventually, and finding out from us is the difference between a credit note and a
 * cancellation.
 */
export function tierDrift(currentPlan: string, rooms: number): TierDrift | null {
  const correct = tierForRooms(rooms);
  if (correct.plan === currentPlan) return null;
  return {
    currentPlan,
    correctPlan: correct.plan,
    rooms,
    monthlyDeltaMinor: (PLAN_BASE_MINOR[correct.plan] ?? 0) - (PLAN_BASE_MINOR[currentPlan] ?? 0),
  };
}

export const MODULE_MINOR: Record<keyof Entitlements, number> = { channelManager: 4900, reservation: 5900, pms: 6900 };
export const MODULE_LABEL: Record<keyof Entitlements, string> = { channelManager: "RevioLink", reservation: "RevioCRS", pms: "RevioPMS" };

/** Monthly price for a client = plan base + the module fee of every entitled product. */
export function monthlyPriceMinor(plan: string, ent: Entitlements): number {
  let total = PLAN_BASE_MINOR[plan] ?? 0;
  (Object.keys(MODULE_MINOR) as (keyof Entitlements)[]).forEach((k) => {
    if (ent[k]) total += MODULE_MINOR[k];
  });
  return total;
}

/** Comma-separated product names a client is billed for (empty string if none). */
export function billedProducts(ent: Entitlements): string {
  return (Object.keys(MODULE_LABEL) as (keyof Entitlements)[]).filter((k) => ent[k]).map((k) => MODULE_LABEL[k]).join(", ");
}
