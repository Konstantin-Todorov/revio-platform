/**
 * Did the guest actually arrive? — one answer for Close Day's screen and the automatic close.
 *
 * ⚠️ "Has an assignment" stopped meaning "arrived" the day auto-assignment (§2.3) started placing
 * every booking in a room on receipt. Both Close Day paths still asked `assignments.length > 0`,
 * so a guest who never came was never a no-show: the booking stayed `confirmed`, kept its room for
 * the rest of the stay and kept those nights off sale. A check-in stamp is the only thing that
 * says somebody walked in — the same test the front desk uses for "in house".
 */
export function hasArrived(assignments: readonly { checkedInAt: Date | null }[]): boolean {
  return assignments.some((a) => a.checkedInAt != null);
}
