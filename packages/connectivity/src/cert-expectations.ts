/**
 * What each Channex certification test must look like on the wire.
 *
 * The first submission failed 8 of 12 because we checked only that Channex returned `success: true`.
 * A task can succeed and still be the wrong data — wrong rate, wrong month, or carrying three
 * restrictions the test never asked for. This file encodes the spec (`docs/CHANNEX-CERT-SPEC.md`) so
 * a payload can be judged before anyone puts its task ID in the form.
 *
 * Pure and tested: the checker that reads Channex is I/O, but deciding whether a payload passes is
 * not, and that decision is the part that was missing.
 */

/** A row as Channex received it — `date` OR `date_from`/`date_to`. */
export interface WireRow {
  rate_plan_id?: string;
  room_type_id?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  rate?: number;
  availability?: number;
  min_stay_arrival?: number;
  min_stay_through?: number;
  max_stay?: number;
  closed_to_arrival?: boolean;
  closed_to_departure?: boolean;
  stop_sell?: boolean;
}

/** One (product, dates, values) the test demands. */
export interface Expectation {
  /** Which mapped product — resolved to a UUID by the caller. */
  product: "twin-bar" | "twin-bnb" | "double-bar" | "double-bnb" | "twin-room" | "double-room";
  /** Inclusive YYYY-MM-DD. `to` omitted = single date. */
  from: string;
  to?: string;
  /** Field → required value. Rates are MINOR units, matching what we send. */
  values: Partial<Record<keyof WireRow, number | boolean>>;
}

export interface TestSpec {
  id: number;
  title: string;
  /** "restrictions" rows carry rate_plan_id, "availability" rows carry room_type_id. */
  endpoint: "restrictions" | "availability";
  /** How many API calls the test allows. */
  calls: number[];
  /** Fields that must NOT appear — the "only what is named" rule. */
  forbidden: (keyof WireRow)[];
  expectations: Expectation[];
}

const RATE_FIELDS: (keyof WireRow)[] = ["rate"];
const ALL_RESTRICTIONS: (keyof WireRow)[] = [
  "min_stay_arrival", "min_stay_through", "max_stay", "closed_to_arrival", "closed_to_departure", "stop_sell",
];

/**
 * The ten ARI tests, verbatim from the spec.
 *
 * `forbidden` is the half we failed. Test 2 says "single date update for single rate": a row that
 * also carries `stop_sell: false` fails, because to a channel that is an instruction to clear a
 * stop-sell, not a no-op.
 */
export const CERT_TESTS: TestSpec[] = [
  {
    id: 2, title: "Single Date Update for Single Rate", endpoint: "restrictions", calls: [1],
    forbidden: ALL_RESTRICTIONS,
    expectations: [{ product: "twin-bar", from: "2026-11-22", values: { rate: 33300 } }],
  },
  {
    id: 3, title: "Single Date Update for Multiple Rates", endpoint: "restrictions", calls: [1],
    forbidden: ALL_RESTRICTIONS,
    expectations: [
      { product: "twin-bar", from: "2026-11-21", values: { rate: 33300 } },
      { product: "double-bar", from: "2026-11-25", values: { rate: 44400 } },
      { product: "double-bnb", from: "2026-11-29", values: { rate: 45623 } },
    ],
  },
  {
    id: 4, title: "Multiple Date Update for Multiple Rates", endpoint: "restrictions", calls: [1],
    forbidden: ALL_RESTRICTIONS,
    expectations: [
      { product: "twin-bar", from: "2026-11-01", to: "2026-11-10", values: { rate: 24100 } },
      { product: "double-bar", from: "2026-11-10", to: "2026-11-16", values: { rate: 31266 } },
      { product: "double-bnb", from: "2026-11-01", to: "2026-11-20", values: { rate: 11100 } },
    ],
  },
  {
    id: 5, title: "Min Stay Update", endpoint: "restrictions", calls: [1],
    forbidden: [...RATE_FIELDS, "max_stay", "closed_to_arrival", "closed_to_departure", "stop_sell"],
    expectations: [
      { product: "twin-bar", from: "2026-11-23", values: { min_stay_arrival: 3, min_stay_through: 3 } },
      { product: "double-bar", from: "2026-11-25", values: { min_stay_arrival: 2, min_stay_through: 2 } },
      { product: "double-bnb", from: "2026-11-15", values: { min_stay_arrival: 5, min_stay_through: 5 } },
    ],
  },
  {
    id: 6, title: "Stop Sell Update", endpoint: "restrictions", calls: [1],
    // The warning we got: "stop sell update also carries other fields (cta, ctd, rate)".
    forbidden: [...RATE_FIELDS, "closed_to_arrival", "closed_to_departure", "min_stay_arrival", "min_stay_through", "max_stay"],
    expectations: [
      { product: "twin-bar", from: "2026-11-14", values: { stop_sell: true } },
      { product: "double-bar", from: "2026-11-16", values: { stop_sell: true } },
      { product: "double-bnb", from: "2026-11-20", values: { stop_sell: true } },
    ],
  },
  {
    id: 7, title: "Multiple Restrictions Update", endpoint: "restrictions", calls: [1],
    forbidden: RATE_FIELDS,
    expectations: [
      { product: "twin-bar", from: "2026-11-01", to: "2026-11-10", values: { closed_to_arrival: true, closed_to_departure: false, max_stay: 4, min_stay_arrival: 1, min_stay_through: 1 } },
      { product: "twin-bnb", from: "2026-11-12", to: "2026-11-16", values: { closed_to_arrival: false, closed_to_departure: true, min_stay_arrival: 6, min_stay_through: 6 } },
      { product: "double-bar", from: "2026-11-10", to: "2026-11-16", values: { closed_to_arrival: true, min_stay_arrival: 2, min_stay_through: 2 } },
      { product: "double-bnb", from: "2026-11-01", to: "2026-11-20", values: { min_stay_arrival: 10, min_stay_through: 10 } },
    ],
  },
  {
    id: 8, title: "Half-year Update", endpoint: "restrictions", calls: [1],
    forbidden: ["max_stay", "stop_sell"],
    expectations: [
      { product: "twin-bar", from: "2026-12-01", to: "2027-05-01", values: { rate: 43200, closed_to_arrival: false, closed_to_departure: false, min_stay_arrival: 2, min_stay_through: 2 } },
      { product: "double-bar", from: "2026-12-01", to: "2027-05-01", values: { rate: 34200, min_stay_arrival: 3, min_stay_through: 3 } },
    ],
  },
  {
    id: 9, title: "Single Date Availability Update", endpoint: "availability", calls: [1, 2],
    forbidden: [...RATE_FIELDS, ...ALL_RESTRICTIONS],
    expectations: [
      { product: "twin-room", from: "2026-11-21", values: { availability: 7 } },
      { product: "double-room", from: "2026-11-25", values: { availability: 0 } },
    ],
  },
  {
    id: 10, title: "Multiple Date Availability Update", endpoint: "availability", calls: [1, 2],
    forbidden: [...RATE_FIELDS, ...ALL_RESTRICTIONS],
    expectations: [
      { product: "twin-room", from: "2026-11-10", to: "2026-11-16", values: { availability: 3 } },
      { product: "double-room", from: "2026-11-17", to: "2026-11-24", values: { availability: 4 } },
    ],
  },
];

const DAY = 86_400_000;
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Expand a wire row (single date or range) into the days it actually covers. */
export function rowDays(row: WireRow): string[] {
  if (row.date) return [row.date];
  if (row.date_from && row.date_to) return eachDay(row.date_from, row.date_to);
  return [];
}

export interface Verdict {
  pass: boolean;
  problems: string[];
  /** Warnings do not fail the test but Channex flags them (e.g. unmerged single dates). */
  warnings: string[];
}

/**
 * Judge one test's payload.
 *
 * `productIds` maps our spec labels to the sandbox UUIDs, so the expectations stay readable and the
 * ids stay out of the spec — the certification docs explicitly call hardcoded UUIDs an anti-pattern.
 */
export function verifyTest(
  spec: TestSpec,
  rows: WireRow[],
  callCount: number,
  productIds: Record<Expectation["product"], string>,
): Verdict {
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!spec.calls.includes(callCount)) {
    problems.push(`expected ${spec.calls.join(" or ")} API call(s), got ${callCount}`);
  }

  const idOf = (r: WireRow) => r.rate_plan_id ?? r.room_type_id;

  for (const exp of spec.expectations) {
    const wantId = productIds[exp.product];
    const wantDays = exp.to ? eachDay(exp.from, exp.to) : [exp.from];
    const mine = rows.filter((r) => idOf(r) === wantId);
    if (mine.length === 0) {
      problems.push(`${exp.product}: no rows at all`);
      continue;
    }

    // Every required day must be covered, and carry every required value.
    const byDay = new Map<string, WireRow>();
    for (const r of mine) for (const d of rowDays(r)) byDay.set(d, r);

    const missing = wantDays.filter((d) => !byDay.has(d));
    if (missing.length) {
      const covered = [...byDay.keys()].sort();
      problems.push(
        `${exp.product}: covers ${covered[0] ?? "nothing"}..${covered[covered.length - 1] ?? "nothing"}, expected ${exp.from}..${exp.to ?? exp.from} (${missing.length} day(s) missing)`,
      );
      continue;
    }
    for (const d of wantDays) {
      const row = byDay.get(d)!;
      for (const [field, want] of Object.entries(exp.values)) {
        const got = row[field as keyof WireRow];
        if (got !== want) {
          problems.push(`${exp.product} ${d}: ${field} is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
          break; // one line per product/day is enough to act on
        }
      }
    }

    // Days outside the expectation must not be touched by this test's rows.
    const extra = [...byDay.keys()].filter((d) => !wantDays.includes(d));
    if (extra.length) {
      problems.push(`${exp.product}: also covers ${extra.length} day(s) the test did not ask for (${extra.slice(0, 3).join(", ")}…)`);
    }
  }

  // The rule that failed us four times: nothing beyond what the test names. Every offending field is
  // listed, not just the first — Channex's own rejection named all three at once, and a reviewer
  // fixing this wants the full set rather than one more round trip per field.
  for (const row of rows) {
    const carried = spec.forbidden.filter((f) => row[f] !== undefined);
    if (carried.length > 0) {
      problems.push(`row for ${idOf(row)} carries ${carried.map((f) => `"${f}"`).join(", ")} — this test must contain none of them`);
    }
  }

  // Channex asks for merged ranges; single-date rows in a consecutive run are a warning, not a fail.
  const singles = rows.filter((r) => r.date && !r.date_from).length;
  if (singles > 1 && spec.expectations.some((e) => e.to)) {
    warnings.push(`${singles} single-date rows — use date_range with merged sequences`);
  }

  return { pass: problems.length === 0, problems, warnings };
}
