/**
 * Demo tenants — ours, in production, permanently.
 *
 * We test on real hotels in the real deployment rather than on a staging copy, because a second
 * environment sharing one database, one Channex account and one bucket is a second thing to keep in
 * sync, and it drifts. Testing against production means every rehearsal runs on the real migrations,
 * the real RLS and the real build.
 *
 * The price of that is two fake hotels sitting inside every number this console reports. A console
 * built to stop us counting things that do not matter cannot itself report revenue that does not
 * exist — €283.20 of imaginary MRR is worse than no MRR figure at all, because it looks true.
 *
 * ## The rule
 *
 * **Money and portfolio metrics exclude demo. Operations and health include it.**
 *
 * - **Excluded** — MRR, billed revenue, unbilled tier drift, forward bookings, the attention feed,
 *   renewals ahead, revenue by product, plan adoption, client counts. These are claims about the
 *   business, and a demo tenant is not business.
 * - **Included** — sync health, error volumes, queue depth, search. These are claims about the
 *   platform, and a demo tenant is a real tenant doing real work: if its pushes are failing, that is
 *   a genuine outage, found early.
 * - **Never hidden.** A demo client appears on every list it belongs on, badged, and its own detail
 *   page works in full — including its attention flags, which is how the flags themselves get tested.
 * - **Still invoiced.** `generateInvoices` bills demo tenants exactly like anyone else so the billing
 *   flow stays testable end to end. Those invoices simply never reach a total.
 *
 * One click on the client page flips it, both ways: a demo tenant that becomes a paying customer
 * keeps its history, and a real client can be borrowed for a test without inventing a new one.
 */

export interface DemoFlagged {
  isDemo: boolean;
}

/**
 * Split a client list into the part that counts as business and the part that does not.
 *
 * Exists so the rule above is applied by name at every call site rather than re-derived as an inline
 * `.filter()` that the next person reads as an accident.
 */
export function partitionDemo<T extends DemoFlagged>(rows: readonly T[]): { real: T[]; demo: T[] } {
  const real: T[] = [];
  const demo: T[] = [];
  for (const r of rows) (r.isDemo ? demo : real).push(r);
  return { real, demo };
}

/** The footnote that goes under any figure demo clients were removed from. `null` when there are none. */
export function demoNote(demoCount: number): string | null {
  if (demoCount <= 0) return null;
  return `${demoCount} demo client${demoCount === 1 ? "" : "s"} excluded — ours, for testing, and never counted as business.`;
}
