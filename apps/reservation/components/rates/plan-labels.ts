/**
 * Plain labels for rate plans — no "use client", so server pages (the plan list, a plan's page) and
 * the client editors both read the same words. A function exported from a client module cannot be
 * called on the server.
 */
export const PRICING_MODEL_LABEL: Record<string, string> = { per_room: "Per room", per_person: "Per person" };

/** "−10%", "+€5" — the difference a derived plan takes from its parent. */
export function offsetOf(
  p: { derivedType: string | null; derivedDirection: string | null; derivedValue: number | null },
  /** The reader's money format (`moneyIn(locale)`); English "€5" when omitted. */
  money?: (minor: number) => string,
): string {
  const sign = p.derivedDirection === "increase" ? "+" : "−";
  if (p.derivedType === "percent") return `${sign}${p.derivedValue}%`;
  return money ? `${sign}${money(p.derivedValue ?? 0)}` : `${sign}€${((p.derivedValue ?? 0) / 100).toLocaleString("en-US")}`;
}
