/**
 * Which rate plans a calendar shows, and in what order.
 *
 * ## The defect this exists to end
 *
 * Reported from Cabacum Beach Residence on 2026-09-12 as fourteen separate bugs. They were one bug:
 * **every read surface assumed a single rate plan per room type, while the write surfaces had been
 * made plan-aware.**
 *
 * The two calendars each resolved "the" plan their own way and got different answers:
 *
 * - RevioCRS took the first ACTIVE manual plan by sort order — *BB Flex*.
 * - RevioLink took `code: "BAR"` with **no `active` filter at all** — *Standard Rate*, a plan the
 *   hotel had switched off.
 *
 * So a price written in the CRS landed on BB Flex, RevioLink rendered Standard Rate, and the price
 * vanished on the way between two products that share one database. It looked like a broken sync and
 * was a read-key mismatch. Every other symptom followed from the same root: an unlabelled "Rate" row
 * (there was only ever one, so why name it), a filter wired to nothing (there was nothing to
 * filter), a price that saved and never appeared (written to plan X, read from plan Y), and an
 * inactive plan offered in a picker that then refused it.
 *
 * ⚠️ **It was a regression, and it was self-inflicted.** Before 2026-09-09 the bulk picker offered
 * the inactive plan too, so hotels wrote to the same wrong plan the calendar read — visibly wrong,
 * but consistent. Fixing the WRITE path to use only active plans (commit `9b528ff`) moved the write
 * to the right plan and left the read on the wrong one. A half-migration is worse than either end of
 * it: the data was correct from that moment on and the screen stopped showing any of it.
 *
 * ## The rule
 *
 * A calendar shows **one row per active rate plan**, labelled with the plan's name, ordered by sort
 * order. There is no "the" plan. A plan the hotel has switched off is never a row and never an
 * option — it cannot hold a price, so offering it is offering a dead end.
 */

export interface RatePlanRowInput {
  id: string;
  code: string;
  name: string;
  active: boolean;
  /** `manual` sets its own prices; `derived` computes from a parent. */
  priceLogic: string;
  sortOrder: number;
  parentRatePlanId: string | null;
}

export interface RatePlanRow {
  id: string;
  code: string;
  /** Always the plan's own name. ⚠️ Never "Rate" — see BUG-001. */
  label: string;
  priceLogic: string;
  /** Set for a derived plan whose parent is itself on screen, for the paperclip. */
  parentRatePlanId: string | null;
}

export interface RatePlanRowsResult {
  rows: RatePlanRow[];
  /** Every active plan, for the filter's option list. Never includes inactive plans. */
  options: { value: string; label: string }[];
  /** The codes that are actually selected, after reconciliation — what the pill must count. */
  selected: string[];
  /**
   * True when a selection was supplied that matched no active plan, so the grid fell back to
   * showing everything rather than rendering blank.
   */
  selectionIgnored: boolean;
}

/**
 * ⚠️ `selected` is reconciled against the live plans rather than trusted.
 *
 * RevioLink defaulted the selection to the hardcoded codes `["BAR", "NR", "BRF"]` — names from the
 * demo data. At a hotel whose plans are `BB48` and `BBNR`, that produced the exact three-way
 * disagreement the report describes: **the pill said "3 selected", the list offered 2, and neither
 * was ticked.** Three numbers describing one control, none of them wrong on its own terms.
 *
 * Reconciling here means the count on the pill, the options in the list and the rows on the grid are
 * computed once, from one set, and cannot disagree again.
 */
export function ratePlanRows(
  plans: readonly RatePlanRowInput[],
  selected?: readonly string[] | null,
): RatePlanRowsResult {
  const active = [...plans]
    .filter((p) => p.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  const options = active.map((p) => ({
    value: p.code,
    label: p.priceLogic === "derived" ? `${p.name} (derived)` : p.name,
  }));

  const asked = (selected ?? []).filter((c) => c);
  const known = new Set(active.map((p) => p.code));
  const kept = asked.filter((c) => known.has(c));

  /*
   * Nothing asked for → show everything. Something asked for that no longer exists → show
   * everything, and say so. The second case is the one that mattered: a stale default must degrade
   * to "all the hotel's plans", never to an empty grid that looks like a hotel with no prices.
   */
  const selectionIgnored = asked.length > 0 && kept.length === 0;
  const show = kept.length > 0 ? active.filter((p) => kept.includes(p.code)) : active;

  return {
    rows: show.map((p) => ({
      id: p.id,
      code: p.code,
      label: p.name,
      priceLogic: p.priceLogic,
      parentRatePlanId: p.parentRatePlanId,
    })),
    options,
    selected: show.map((p) => p.code),
    selectionIgnored,
  };
}

/**
 * Every plan id whose stored prices a calendar must load.
 *
 * A derived row is computed from its parent, and the parent may itself be switched off or filtered
 * out of view — so the price query needs the parents as well as the rows, or a derived row renders
 * "—" for a plan that has a perfectly good parent price behind it.
 */
export function ratePlanIdsToLoad(
  rows: readonly RatePlanRow[],
  allPlans: readonly RatePlanRowInput[],
): string[] {
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.id);
    if (r.parentRatePlanId) ids.add(r.parentRatePlanId);
  }
  // A parent's own parent, for a chain. Bounded by the number of plans, so it cannot loop forever
  // even if the data contains a cycle.
  const byId = new Map(allPlans.map((p) => [p.id, p]));
  for (let hop = 0; hop < allPlans.length; hop++) {
    let grew = false;
    for (const id of [...ids]) {
      const parent = byId.get(id)?.parentRatePlanId;
      if (parent && !ids.has(parent)) {
        ids.add(parent);
        grew = true;
      }
    }
    if (!grew) break;
  }
  return [...ids];
}
