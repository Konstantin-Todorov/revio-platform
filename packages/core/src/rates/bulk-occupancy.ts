import { MAX_OCCUPANCY } from "./occupancy-options.js";

/**
 * Bulk-editing per-occupancy prices across room types and rate plans — CRS §6.4.
 *
 * ## The mixed-cap rule, and why it inverts the plan-level one
 *
 * A bulk edit can span a 2-guest Double and a 4-guest Family. The spec says: render rows up to the
 * **highest** cap, and **skip** occupancies that exceed a given room type's max when applying —
 * never send occupancy 4 to a 2-cap room.
 *
 * That is the opposite of `planCeiling`, which takes the **smallest** cap. Both are correct because
 * they answer different questions:
 *
 *   `planCeiling`  — "what shape is this PLAN?" One option set that must be valid everywhere the
 *                    plan is sold, so the smallest cap governs.
 *   here           — "what am I EDITING?" A matrix across rooms of different sizes. Rendering to the
 *                    smallest would hide the Family's 3- and 4-guest prices behind a Double that
 *                    happens to be selected, and the user would have no way to reach them.
 *
 * Getting these backwards is silent: the edit succeeds and simply does less than the person asked.
 * So the skip is reported, per room type, and shown in the preview.
 *
 * ## Two entry modes
 *
 * **Manual** sets each occupancy explicitly. **Primary + offsets** sets the primary once and derives
 * the rest — Channex's recommended path, and the right default for "each extra guest is €20 more",
 * which is what most hotels actually mean.
 *
 * Pure. The caller writes what this decides.
 */

export type BulkOp = "set" | "inc_pct" | "dec_pct" | "inc_amt" | "dec_amt";

export interface OccupancyEdit {
  occupancy: number;
  op: BulkOp;
  /** Currency units for set/amount ops, percent for the percent ops. */
  value: number;
}

export interface BulkTargetRoom {
  roomTypeId: string;
  roomName: string;
  maxOccupancy: number;
}

/**
 * Rows to RENDER: one per occupancy up to the highest cap in the selection.
 *
 * `appliesTo` says which of the selected rooms each row will actually reach, so the UI can grey a
 * row rather than letting somebody type a price that silently goes nowhere.
 */
export function matrixRows(rooms: readonly BulkTargetRoom[]): {
  occupancy: number;
  appliesTo: string[];
  skippedBy: string[];
}[] {
  if (rooms.length === 0) return [];
  const ceiling = Math.min(MAX_OCCUPANCY, Math.max(...rooms.map((r) => Math.max(1, r.maxOccupancy))));
  return Array.from({ length: ceiling }, (_, i) => i + 1).map((occupancy) => ({
    occupancy,
    appliesTo: rooms.filter((r) => occupancy <= r.maxOccupancy).map((r) => r.roomName),
    skippedBy: rooms.filter((r) => occupancy > r.maxOccupancy).map((r) => r.roomName),
  }));
}

/** Apply one operation to one existing price. */
export function applyOp(baseMinor: number, op: BulkOp, value: number): number {
  switch (op) {
    case "set":
      return Math.max(0, Math.round(value * 100));
    case "inc_pct":
      return Math.max(0, Math.round(baseMinor * (1 + value / 100)));
    case "dec_pct":
      return Math.max(0, Math.round(baseMinor * (1 - value / 100)));
    case "inc_amt":
      return Math.max(0, baseMinor + Math.round(value * 100));
    case "dec_amt":
      // Clamped at zero rather than going negative. Channex rejects a negative rate per-object
      // inside an HTTP 200, and a negative price is never what anybody meant.
      return Math.max(0, baseMinor - Math.round(value * 100));
  }
}

export interface OffsetRule {
  /** Applied to every occupancy BELOW the primary, cumulatively per step away from it. */
  perGuestBelow?: { op: "dec_pct" | "dec_amt"; value: number };
  /** Applied to every occupancy ABOVE the primary, cumulatively per step. */
  perGuestAbove?: { op: "inc_pct" | "inc_amt"; value: number };
}

/**
 * Turn "primary + offsets" into an explicit edit per occupancy.
 *
 * Offsets compound per STEP from the primary, not from the neighbouring row — "each extra guest is
 * €20" on a primary of 2 means 3 guests is +€20 and 4 guests is +€40. Deriving each row from the one
 * below would give the same answer for a fixed amount and a different one for a percentage, and the
 * per-step reading is what a hotelier means by "per extra guest".
 */
export function expandOffsets(
  occupancies: readonly number[],
  primaryOccupancy: number,
  primaryValue: number,
  rule: OffsetRule,
): OccupancyEdit[] {
  return occupancies.map((occupancy) => {
    const steps = occupancy - primaryOccupancy;
    if (steps === 0) return { occupancy, op: "set" as BulkOp, value: primaryValue };

    const spec = steps > 0 ? rule.perGuestAbove : rule.perGuestBelow;
    if (!spec) return { occupancy, op: "set" as BulkOp, value: primaryValue };

    const n = Math.abs(steps);
    const primaryMinor = Math.round(primaryValue * 100);
    let minor = primaryMinor;
    for (let i = 0; i < n; i++) minor = applyOp(minor, spec.op, spec.value);
    return { occupancy, op: "set" as BulkOp, value: minor / 100 };
  });
}

export interface BulkPlanInput {
  rooms: readonly BulkTargetRoom[];
  ratePlanIds: readonly string[];
  dateKeys: readonly string[];
  edits: readonly OccupancyEdit[];
  /** Existing price for a target, so percentage ops have something to work from. */
  currentMinor: (roomTypeId: string, ratePlanId: string, dateKey: string, occupancy: number) => number | null;
}

export interface BulkWrite {
  roomTypeId: string;
  ratePlanId: string;
  dateKey: string;
  occupancy: number;
  minor: number;
}

export interface BulkPlanResult {
  writes: BulkWrite[];
  /** Per room type, which occupancies were skipped because the room does not sleep that many. */
  skipped: { roomName: string; occupancies: number[] }[];
  /** Percentage edits with no existing price to work from — reported, never treated as zero. */
  unpriced: number;
}

export function planBulkOccupancy(input: BulkPlanInput): BulkPlanResult {
  const writes: BulkWrite[] = [];
  const skipped = new Map<string, number[]>();
  let unpriced = 0;

  for (const room of input.rooms) {
    for (const edit of input.edits) {
      // The skip that makes mixed caps safe: never write occupancy 4 to a 2-guest room.
      if (edit.occupancy > room.maxOccupancy) {
        const list = skipped.get(room.roomName) ?? [];
        if (!list.includes(edit.occupancy)) list.push(edit.occupancy);
        skipped.set(room.roomName, list);
        continue;
      }
      for (const ratePlanId of input.ratePlanIds) {
        for (const dateKey of input.dateKeys) {
          const base = input.currentMinor(room.roomTypeId, ratePlanId, dateKey, edit.occupancy);
          if (edit.op !== "set" && base == null) {
            // A percentage of nothing is nothing. Writing 0 here would set a free room; skipping and
            // saying so lets the person set a price first.
            unpriced++;
            continue;
          }
          writes.push({
            roomTypeId: room.roomTypeId,
            ratePlanId,
            dateKey,
            occupancy: edit.occupancy,
            minor: applyOp(base ?? 0, edit.op, edit.value),
          });
        }
      }
    }
  }

  return {
    writes,
    skipped: [...skipped.entries()].map(([roomName, occupancies]) => ({
      roomName,
      occupancies: occupancies.sort((a, b) => a - b),
    })),
    unpriced,
  };
}

/** The preview line. Says what will not happen as plainly as what will. */
export function describeBulkPlan(result: BulkPlanResult): string {
  const n = result.writes.length;

  /*
   * "Nothing to change" is only the whole story when nothing was REFUSED.
   *
   * If every target was skipped — a percentage with no price to work from, or occupancies no
   * selected room sleeps — then saying "nothing to change with these settings" points at the
   * settings, which are fine. The person would go on adjusting the one thing that is not wrong.
   */
  const parts: string[] =
    n === 0
      ? result.skipped.length === 0 && result.unpriced === 0
        ? ["Nothing to change with these settings."]
        : ["Nothing will change, and here is why."]
      : [`${n} price${n === 1 ? "" : "s"} will change.`];
  for (const s of result.skipped) {
    parts.push(
      `${s.roomName} sleeps fewer than ${Math.min(...s.occupancies)}, so ${s.occupancies.length === 1 ? "that guest count is" : "those guest counts are"} skipped for it.`,
    );
  }
  if (result.unpriced > 0) {
    parts.push(
      `${result.unpriced} ${result.unpriced === 1 ? "date has" : "dates have"} no price yet, so a percentage change has nothing to work from — set a price there first.`,
    );
  }
  return parts.join(" ");
}
