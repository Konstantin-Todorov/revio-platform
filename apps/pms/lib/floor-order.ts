/**
 * The order floors are shown in — one rule for the Floors card, the calendar and the housekeeping
 * board, which until now each sorted their own way (the calendar put "10" before "2").
 *
 * A floor is only what its rooms say (`Unit.floor`), so the hotel's chosen order
 * (`Property.floorOrder`) may name floors that no longer have rooms, and miss floors that were
 * typed later. The saved order wins for the floors it names; the rest follow by the number in their
 * name ("2" before "10", "Floor 1" beside "3"), then the floors with no number, alphabetically.
 * No floor at all is never in this list — callers show it last.
 */
export function orderFloors(floors: Iterable<string>, saved: readonly string[] = []): string[] {
  const present = [...new Set([...floors].map((f) => f.trim()).filter(Boolean))];
  const rank = new Map(saved.map((f, i) => [f, i]));
  const num = (f: string) => {
    const m = f.match(/-?\d+/);
    return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
  };
  return present.sort((a, b) => {
    const ra = rank.get(a), rb = rank.get(b);
    if (ra !== undefined || rb !== undefined) return (ra ?? Infinity) - (rb ?? Infinity);
    return num(a) - num(b) || a.localeCompare(b, undefined, { numeric: true });
  });
}
