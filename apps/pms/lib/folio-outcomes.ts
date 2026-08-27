/**
 * How closed folios ended, in totals — J1 (§1.4).
 *
 * ## What the verification found
 *
 * J1 asked whether **mark-paid and write-off are reported separately everywhere they surface**,
 * because both close a folio owing nothing and one is revenue collected while the other is revenue
 * lost. The answer, checked against the code rather than assumed:
 *
 *   - **They cannot be conflated.** A write-off posts no folio line at all — it only sets
 *     `Folio.outcome` — so nothing that sums payments can ever count it as income. That is the
 *     failure the spec feared and it does not exist.
 *   - **But neither is reported anywhere.** `written_off` and `paid_offsystem` appear in exactly one
 *     place in the product: the label on a single folio. No total, no list, no report.
 *
 * So J1 passed **by absence**, which is not the same as passing. An owner could not answer "how much
 * did we write off last month" without opening folios one at a time, and money that arrived
 * off-system was equally invisible. This closes that.
 *
 * ## Why the four outcomes are never summed into one number
 *
 * They are four different facts about money and adding them produces a number that means nothing:
 * settled and paid-off-system are revenue collected by different routes, outstanding is revenue owed,
 * and written off is revenue gone. The type below deliberately has no `total`.
 *
 * Pure. Rows in, totals out.
 */

export type FolioOutcome = "settled" | "paid_offsystem" | "outstanding" | "written_off";

export const FOLIO_OUTCOMES: readonly FolioOutcome[] = [
  "settled",
  "paid_offsystem",
  "outstanding",
  "written_off",
] as const;

export interface OutcomeRow {
  outcome: string | null;
  /** What the folio was worth — the charges, not the balance. */
  grossMinor: number;
}

export interface OutcomeTotal {
  outcome: FolioOutcome;
  label: string;
  /** One line saying what this number IS, because "€513" alone invites the wrong reading. */
  meaning: string;
  count: number;
  amountMinor: number;
  /** How to colour it: money in, money owed, money gone. */
  tone: "collected" | "owed" | "lost";
}

const META: Record<FolioOutcome, Pick<OutcomeTotal, "label" | "meaning" | "tone">> = {
  settled: {
    label: "Settled",
    meaning: "Paid in full through the folio.",
    tone: "collected",
  },
  paid_offsystem: {
    label: "Paid off-system",
    meaning: "The money arrived by bank transfer, cash or an external terminal. Collected, just not through us.",
    tone: "collected",
  },
  outstanding: {
    label: "Still owed",
    meaning: "Closed carrying a balance. A tracked receivable, not a loss — yet.",
    tone: "owed",
  },
  written_off: {
    label: "Written off",
    meaning: "Forgiven. This is a loss, and it is never a payment.",
    tone: "lost",
  },
};

/**
 * Totals per outcome, in a fixed order, including the zeroes.
 *
 * **The zeroes matter.** A month with nothing written off should say "Written off — €0", not omit
 * the row: an absent row reads as "not measured" and is exactly how a number stops being watched.
 */
export function summariseOutcomes(rows: readonly OutcomeRow[]): OutcomeTotal[] {
  const byOutcome = new Map<FolioOutcome, { count: number; amountMinor: number }>();
  for (const o of FOLIO_OUTCOMES) byOutcome.set(o, { count: 0, amountMinor: 0 });

  for (const r of rows) {
    if (!r.outcome) continue; // still open — not an outcome yet
    const key = r.outcome as FolioOutcome;
    const bucket = byOutcome.get(key);
    // An outcome we do not recognise is skipped rather than lumped into a bucket it does not belong
    // in. A new value should show up as missing, not as an inflated "settled".
    if (!bucket) continue;
    bucket.count += 1;
    bucket.amountMinor += r.grossMinor;
  }

  return FOLIO_OUTCOMES.map((outcome) => ({
    outcome,
    ...META[outcome],
    ...byOutcome.get(outcome)!,
  }));
}

/**
 * The two numbers an owner actually asks for, kept apart on purpose.
 *
 * `collectedMinor` sums the two routes money genuinely arrived by. `lostMinor` is written off alone —
 * outstanding is deliberately in neither, because it is not yet either one.
 */
export function outcomeHeadline(totals: readonly OutcomeTotal[]): {
  collectedMinor: number;
  owedMinor: number;
  lostMinor: number;
} {
  const sum = (tone: OutcomeTotal["tone"]) =>
    totals.filter((t) => t.tone === tone).reduce((s, t) => s + t.amountMinor, 0);
  return { collectedMinor: sum("collected"), owedMinor: sum("owed"), lostMinor: sum("lost") };
}
