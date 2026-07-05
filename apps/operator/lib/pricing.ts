// Operator-side pricing model (what we charge hotels). Simple, transparent: a plan/tier base fee +
// a per-product module fee for each entitled product. Money is integer minor units (cents), EUR.

export type Entitlements = { channelManager: boolean; reservation: boolean; pms: boolean };

/** Plan tier base fee (room-count tier uplift). starter is the entry tier. */
export const PLAN_BASE_MINOR: Record<string, number> = { starter: 0, growth: 5000, scale: 15000 };

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
