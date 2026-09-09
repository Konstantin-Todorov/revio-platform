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

/**
 * What a RECORDED decision means, for the screen that has to show it back.
 *
 * ## Why this was needed
 *
 * The founder reported that pressing **Mark paid** did nothing — "no error, no message at all". The
 * action was in fact working: it wrote the outcome and returned. But it said nothing, and the screen
 * could not tell a decided folio from an undecided one, because it branched on the BALANCE
 * (`combined.balance === 0`) and none of these four exits changes a balance.
 *
 * So after marking it paid the page re-rendered with the same red "closed with €513 outstanding"
 * banner and the same four buttons. Working code and a screen that looked identical afterwards is
 * indistinguishable from a broken button — and worse, because it invites pressing it again.
 *
 * `outcome === null` is the only undecided state. Everything else has been decided by a person, and
 * the screen owes them the answer back.
 */
export interface ResolutionSummary {
  headline: string;
  /** What it means for the money. The balance is unchanged in every case, so this has to say so. */
  meaning: string;
  tone: "collected" | "owed" | "lost";
  /** Still chased, and still on the receivables list. Only `outstanding` is. */
  stillOwed: boolean;
}

const RESOLUTION_SUMMARY: Record<FolioOutcome, ResolutionSummary> = {
  settled: {
    headline: "Settled through the folio",
    meaning: "Paid in full, the ordinary way.",
    tone: "collected",
    stillOwed: false,
  },
  paid_offsystem: {
    headline: "Paid off-system",
    meaning:
      "The money arrived by bank transfer, cash or an external terminal. The folio still shows a balance because nothing was posted through it — that is deliberate, so the payment is never double-counted as revenue we processed.",
    tone: "collected",
    stillOwed: false,
  },
  outstanding: {
    headline: "Kept as a receivable",
    meaning: "Still owed and still being chased. It stays on the receivables list until that changes.",
    tone: "owed",
    stillOwed: true,
  },
  written_off: {
    headline: "Written off",
    meaning: "The balance is forgiven and recorded as a loss. It is never counted as a payment.",
    tone: "lost",
    stillOwed: false,
  },
};

/** The decision on a folio, or null while nobody has made one. */
export function describeResolution(outcome: string | null | undefined): ResolutionSummary | null {
  if (!outcome) return null;
  return RESOLUTION_SUMMARY[outcome as FolioOutcome] ?? null;
}

/**
 * What to tell the person who just pressed the button.
 *
 * Names the amount and what happens to it, because the folio balance will not change and the number
 * on screen will look untouched. "Recorded" alone would leave them checking whether it worked.
 */
export function resolutionConfirmation(resolution: string, moneyLabel: string): string {
  switch (resolution) {
    case "reopen":
      return `Folio reopened. Post the payment and it will close at zero.`;
    case "paid_offsystem":
      return `Recorded as paid off-system. ${moneyLabel} counts as collected, and the folio keeps showing the balance because nothing was posted through it.`;
    case "receivable":
      return `Kept as a receivable. ${moneyLabel} stays on the receivables list until somebody resolves it.`;
    case "written_off":
      return `Written off. ${moneyLabel} is recorded as a loss, never as a payment.`;
    default:
      return "Decision recorded.";
  }
}
