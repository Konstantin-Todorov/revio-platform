/**
 * What is filtering this list, said out loud — and removable one at a time.
 *
 * ## The gap this closes
 *
 * The filter form shows its own values, but only if you read five controls and work out which of
 * them are doing anything. Arrive from a link, a bookmark or the browser's back button and the
 * first question is always the same: *why am I not seeing the booking I know exists?* Usually
 * because a date range from twenty minutes ago is still applied. One `Clear` button answers that
 * with "start again", which is why people stop using filters rather than refine them.
 *
 * ## Rules
 *
 * 1. **A chip removes its own filter and leaves every other one.** That is the whole difference
 *    from `Clear`. Someone narrowed to *confirmed, last week* wants to drop the week and keep
 *    confirmed — two clicks today, and the second one is a re-type.
 * 2. **`from`/`to`/`dateType` are ONE chip.** Removing half a range leaves an open-ended filter
 *    that quietly returns a different set than either the range or no range — the reader clicked
 *    once to remove something and got a third answer they never asked for.
 * 3. **A date type with no range is not a chip**, because it is not filtering anything. A badge for
 *    an inert control teaches people the badges are decorative.
 * 4. **When a segment tab is lit, there are no chips at all.** The lit tab already says "Arriving
 *    today" in the reader's own vocabulary; repeating it underneath as `Check-in 2026-09-12 →
 *    2026-09-12` is the same fact in a worse shape, and the two would eventually disagree.
 */

export interface FilterChip {
  /** Stable id for React keys and tests — not necessarily a single param name. */
  key: string;
  /** What is being filtered on. */
  label: string;
  /** The value, in the reader's words rather than the database's. */
  value: string;
  /** This page, with exactly this filter dropped. */
  href: string;
}

export interface ChipParams {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  dateType?: string;
}

function hrefWithout(basePath: string, params: ChipParams, drop: (keyof ChipParams)[]): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    if (drop.includes(k as keyof ChipParams)) continue;
    qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function filterChips(
  params: ChipParams,
  opts: {
    basePath: string;
    /** Human label per date type, e.g. `check_in` → "Check-in". */
    dateTypeLabels: Record<string, string>;
    /** A lit segment tab already states the date filter — rule 4. */
    segmentActive?: boolean;
  },
): FilterChip[] {
  if (opts.segmentActive) return [];

  const chips: FilterChip[] = [];

  if (params.q) {
    chips.push({
      key: "q",
      label: "Search",
      value: params.q,
      href: hrefWithout(opts.basePath, params, ["q"]),
    });
  }

  if (params.status) {
    chips.push({
      key: "status",
      label: "Status",
      // The database's `no_show` is not a word. Say it the way the pill on the row says it.
      value: params.status.replace(/_/g, " "),
      href: hrefWithout(opts.basePath, params, ["status"]),
    });
  }

  // Rule 2 + rule 3 — one chip, and only when a range is actually set.
  if (params.from || params.to) {
    const label = opts.dateTypeLabels[params.dateType ?? ""] ?? opts.dateTypeLabels.check_in ?? "Date";
    const value = params.from && params.to
      ? `${params.from} → ${params.to}`
      : params.from
        ? `from ${params.from}`
        : `until ${params.to}`;
    chips.push({
      key: "date",
      label,
      value,
      href: hrefWithout(opts.basePath, params, ["from", "to", "dateType"]),
    });
  }

  return chips;
}

/** `Clear` earns its place only once there is more than one thing to clear. */
export function showClearAll(chips: FilterChip[]): boolean {
  return chips.length > 1;
}
