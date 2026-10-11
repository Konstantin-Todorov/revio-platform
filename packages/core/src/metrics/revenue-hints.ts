/**
 * Revenue hints — "look at this night's price", said with the numbers that justify it.
 *
 * A small hotel has no revenue manager. The owner opens the dashboard, sees a calendar, and has to
 * notice for themselves that next Friday is nearly full at the same price as an empty Tuesday. This
 * module notices it for them. It **suggests and never changes a price**: every hint links to the
 * night in the calendar and stops there, because the hotel knows things we do not (a wedding, a
 * group on option, a renovation).
 *
 * ## The four hints, and the judgement in each
 *
 * - **filling_fast** — a night is selling faster than it has room to keep doing. Either it is
 *   already ≥ 75% sold with a week or more to go, or it picked up ≥ 30% of its rooms in the last
 *   seven days and has ≤ 40% left. A week out is the floor because inside it the price matters less
 *   than whether the room sells at all.
 * - **flat_price** — a nearly-full night (≥ 80%) is priced no higher than the median of the same
 *   room's quiet nights (≤ 30%) in the window. Demand differs and the price does not, which is the
 *   single most common thing a small hotel leaves on the table. Needs three quiet nights to compare
 *   against, otherwise "the usual price" is not a thing we know. It replaces `filling_fast` for the
 *   same night: it says the same thing more precisely.
 * - **unsold_soon** — one to three days away, ≤ 40% sold, two or more rooms left. Not "discount":
 *   the action might be a last-minute rate, or opening a channel that is closed. Today is excluded —
 *   by the time the dashboard is read, today is the front desk's problem, not a pricing one.
 * - **behind_last_year** — a seven-day block starting a week out has sold < 60% of what the same
 *   week sold last year (364 days back, so weekdays line up), and last year sold at least six
 *   room-nights there. Below six the comparison is noise: one cancelled group swings it.
 *
 * Capacity is what can actually be sold that night (after out-of-order and closures), so a night
 * with three rooms closed for repair is not reported as "quiet".
 *
 * Ranked: specific before general, sooner before later. At most six — a list of twenty is a list
 * nobody reads, and the point is the two or three that matter this week.
 */

export interface HintNight {
  /** Stay date, YYYY-MM-DD, in the property's calendar. */
  date: string;
  /** Days from the property's today. 0 is today. */
  daysOut: number;
  roomTypeId: string;
  roomTypeName: string;
  /** Rooms that can be sold this night (the waterfall's `available`). */
  capacity: number;
  /** Rooms sold this night. */
  sold: number;
  /** The headline price of the room this night, minor units — null when nothing resolves. */
  priceMinor: number | null;
  /** Rooms sold this night as of seven days ago — null when no snapshot exists that far back. */
  soldWeekAgo: number | null;
  /** Rooms sold on the same weekday last year (364 days back) — null when we have no history. */
  soldLastYear: number | null;
}

export type RevenueHint =
  | {
      kind: "filling_fast";
      date: string;
      /** Last night of a run of consecutive nights saying the same thing; equals `date` for one. */
      to: string;
      nights: number;
      roomTypeId: string;
      roomTypeName: string;
      sold: number;
      capacity: number;
      /** Rooms sold in the last seven days, when known. */
      pickup: number | null;
      priceMinor: number | null;
    }
  | {
      kind: "flat_price";
      date: string;
      to: string;
      nights: number;
      roomTypeId: string;
      roomTypeName: string;
      sold: number;
      capacity: number;
      priceMinor: number;
      /** The median price of this room's quiet nights in the same window. */
      quietPriceMinor: number;
    }
  | {
      kind: "unsold_soon";
      date: string;
      to: string;
      nights: number;
      roomTypeId: string;
      roomTypeName: string;
      /** How many room types this line speaks for. Above 1 it is the whole hotel, and the name is "". */
      roomTypes: number;
      sold: number;
      capacity: number;
      daysOut: number;
      priceMinor: number | null;
    }
  | {
      kind: "behind_last_year";
      /** First night of the seven-day block. */
      from: string;
      /** Last night of the block (inclusive). */
      to: string;
      sold: number;
      soldLastYear: number;
    };

export const REVENUE_HINT_LIMIT = 6;

const FILL_OCC = 0.75;
const FLAT_FULL_OCC = 0.8;
const QUIET_OCC = 0.3;
const MIN_QUIET_NIGHTS = 3;
const PICKUP_SHARE = 0.3;
const PICKUP_LEFT_SHARE = 0.4;
const SOON_MAX_OCC = 0.4;
const BEHIND_SHARE = 0.6;
const BEHIND_MIN_LAST_YEAR = 6;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export function revenueHints(nights: HintNight[]): RevenueHint[] {
  const out: { hint: RevenueHint; rank: number; daysOut: number }[] = [];

  // The usual price of each room on a quiet night, from the window itself.
  const quietByRoom = new Map<string, number[]>();
  for (const n of nights) {
    if (n.capacity < 2 || n.priceMinor == null || n.daysOut < 1) continue;
    if (n.sold / n.capacity <= QUIET_OCC) {
      const list = quietByRoom.get(n.roomTypeId) ?? [];
      list.push(n.priceMinor);
      quietByRoom.set(n.roomTypeId, list);
    }
  }

  for (const n of nights) {
    if (n.capacity < 2 || n.daysOut < 1) continue;
    const occ = n.sold / n.capacity;
    const left = n.capacity - n.sold;

    const quiet = quietByRoom.get(n.roomTypeId) ?? [];
    if (occ >= FLAT_FULL_OCC && left >= 1 && n.priceMinor != null && quiet.length >= MIN_QUIET_NIGHTS) {
      const usual = median(quiet);
      if (n.priceMinor <= usual) {
        out.push({
          hint: {
            kind: "flat_price", date: n.date, to: n.date, nights: 1, roomTypeId: n.roomTypeId, roomTypeName: n.roomTypeName,
            sold: n.sold, capacity: n.capacity, priceMinor: n.priceMinor, quietPriceMinor: usual,
          },
          rank: 0, daysOut: n.daysOut,
        });
        continue;
      }
    }

    if (n.daysOut >= 7 && left >= 1) {
      const pickup = n.soldWeekAgo == null ? null : Math.max(0, n.sold - n.soldWeekAgo);
      const fastPickup = pickup != null
        && pickup >= Math.max(2, Math.ceil(PICKUP_SHARE * n.capacity))
        && left <= Math.ceil(PICKUP_LEFT_SHARE * n.capacity);
      if (occ >= FILL_OCC || fastPickup) {
        out.push({
          hint: {
            kind: "filling_fast", date: n.date, to: n.date, nights: 1, roomTypeId: n.roomTypeId, roomTypeName: n.roomTypeName,
            sold: n.sold, capacity: n.capacity, pickup, priceMinor: n.priceMinor,
          },
          rank: 1, daysOut: n.daysOut,
        });
        continue;
      }
    }

    if (n.daysOut <= 3 && occ <= SOON_MAX_OCC && left >= 2) {
      out.push({
        hint: {
          kind: "unsold_soon", date: n.date, to: n.date, nights: 1, roomTypeId: n.roomTypeId, roomTypeName: n.roomTypeName, roomTypes: 1,
          sold: n.sold, capacity: n.capacity, daysOut: n.daysOut, priceMinor: n.priceMinor,
        },
        rank: 2, daysOut: n.daysOut,
      });
    }
  }

  // Property-level weekly comparison with last year, from a week out.
  const byDate = new Map<string, { sold: number; lastYear: number; known: boolean; daysOut: number }>();
  for (const n of nights) {
    const d = byDate.get(n.date) ?? { sold: 0, lastYear: 0, known: false, daysOut: n.daysOut };
    d.sold += n.sold;
    if (n.soldLastYear != null) {
      d.lastYear += n.soldLastYear;
      d.known = true;
    }
    byDate.set(n.date, d);
  }
  const future = [...byDate.entries()].filter(([, d]) => d.daysOut >= 7).sort(([a], [b]) => (a < b ? -1 : 1));
  for (let i = 0; i + 7 <= future.length; i += 7) {
    const block = future.slice(i, i + 7);
    if (!block.every(([, d]) => d.known)) continue;
    const sold = block.reduce((s, [, d]) => s + d.sold, 0);
    const lastYear = block.reduce((s, [, d]) => s + d.lastYear, 0);
    if (lastYear >= BEHIND_MIN_LAST_YEAR && sold < BEHIND_SHARE * lastYear) {
      out.push({
        hint: { kind: "behind_last_year", from: block[0]![0], to: block[block.length - 1]![0], sold, soldLastYear: lastYear },
        rank: 3, daysOut: block[0]![1].daysOut,
      });
    }
  }

  return wholeHotel(mergeRuns(out))
    .sort((a, b) => a.rank - b.rank || a.daysOut - b.daysOut)
    .slice(0, REVENUE_HINT_LIMIT)
    .map((o) => o.hint);
}

/**
 * Several room types empty over the same nights is one fact about the hotel, not six about rooms —
 * six identical rows push every other hint off the card. Prices differ by room, so none is quoted.
 */
function wholeHotel<T extends { hint: RevenueHint; rank: number; daysOut: number }>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  const rest: T[] = [];
  for (const item of items) {
    if (item.hint.kind !== "unsold_soon") { rest.push(item); continue; }
    const key = `${item.hint.date}:${item.hint.to}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const group of groups.values()) {
    if (group.length === 1) { rest.push(group[0]!); continue; }
    const first = group[0]!;
    const h = first.hint as Extract<RevenueHint, { kind: "unsold_soon" }>;
    const all = group.map((g) => g.hint as Extract<RevenueHint, { kind: "unsold_soon" }>);
    rest.push({
      ...first,
      hint: {
        ...h, roomTypeId: "", roomTypeName: "", roomTypes: group.length, priceMinor: null,
        sold: all.reduce((n, x) => n + x.sold, 0), capacity: all.reduce((n, x) => n + x.capacity, 0),
      },
    });
  }
  return rest;
}

const nextDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * One line for a run of nights that say the same thing. Three rows reading "Loft is mostly empty
 * tomorrow / in 2 days / in 3 days" is one fact told three times, and it pushes the next real hint
 * off the card. Counts are summed into room-nights; a price is kept only when every night shares it,
 * because "at €90" over a run priced €90 and €120 would be a number nobody set.
 */
function mergeRuns<T extends { hint: RevenueHint; rank: number; daysOut: number }>(items: T[]): T[] {
  type Night = Extract<RevenueHint, { date: string }>;
  const perNight = items.filter((i): i is T & { hint: Night } => "date" in i.hint)
    .sort((a, b) => (a.hint.roomTypeId + a.hint.kind + a.hint.date < b.hint.roomTypeId + b.hint.kind + b.hint.date ? -1 : 1));
  const merged: T[] = [];
  for (const item of perNight) {
    const last = merged[merged.length - 1] as (T & { hint: Night }) | undefined;
    const h = item.hint;
    if (last && last.hint.kind === h.kind && last.hint.roomTypeId === h.roomTypeId && nextDay(last.hint.to) === h.date) {
      const a = last.hint;
      const joined = { ...a, to: h.date, nights: a.nights + 1, sold: a.sold + h.sold, capacity: a.capacity + h.capacity } as Night;
      if (joined.kind === "filling_fast" && h.kind === "filling_fast") {
        joined.pickup = joined.pickup == null || h.pickup == null ? null : joined.pickup + h.pickup;
        joined.priceMinor = joined.priceMinor === h.priceMinor ? joined.priceMinor : null;
      }
      if (joined.kind === "unsold_soon" && h.kind === "unsold_soon") {
        joined.priceMinor = joined.priceMinor === h.priceMinor ? joined.priceMinor : null;
      }
      if (joined.kind === "flat_price" && h.kind === "flat_price" && joined.priceMinor !== h.priceMinor) {
        // Different prices on a run of full nights: keep the lower — it is the one most worth raising.
        joined.priceMinor = Math.min(joined.priceMinor, h.priceMinor);
      }
      merged[merged.length - 1] = { ...last, hint: joined };
    } else {
      merged.push(item);
    }
  }
  return [...merged, ...items.filter((i) => !("date" in i.hint))];
}
