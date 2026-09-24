/**
 * Plain labels for rate plans — no "use client", so server pages (the plan list, a plan's page) and
 * the client editors both read the same words. A function exported from a client module cannot be
 * called on the server.
 */
export const PRICING_MODEL_LABEL: Record<string, string> = { per_room: "Per room", per_person: "Per person" };

/** "−10%", "+€5" — the difference a derived plan takes from its parent. */
export function offsetOf(p: { derivedType: string | null; derivedDirection: string | null; derivedValue: number | null }): string {
  const sign = p.derivedDirection === "increase" ? "+" : "−";
  return p.derivedType === "percent" ? `${sign}${p.derivedValue}%` : `${sign}€${((p.derivedValue ?? 0) / 100).toLocaleString("en-US")}`;
}
