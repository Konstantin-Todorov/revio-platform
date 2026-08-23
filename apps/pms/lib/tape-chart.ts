import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { ymd, todayInTz, addDaysYmd } from "./format";
import type { HkStatus } from "./hk-meta";

/**
 * The reservations calendar: physical rooms down, dates across, one bar per stay (§2.1).
 *
 * Front Desk is "today as a list"; this is "the coming weeks as a grid" — the spatial view a
 * receptionist actually thinks in when asked "can we fit a walk-in on Friday?".
 *
 * **No rates, deliberately.** Rates live in the CRS. The PMS reads them in exactly one place — the
 * price difference on a cross-type move — and nowhere else. A calendar showing prices would be a
 * second rate screen, drifting from the first.
 *
 * **No unassigned row**, because there is no unassigned state (§2.3): every reservation is placed
 * on receipt, so the grid can always draw all of it.
 */

export type BarStatus =
  | "arrival"      // arrives today
  | "due_out"      // departs today
  | "in_house"
  | "confirmed"    // future, not yet arrived
  | "overstayed"   // past departure, still in
  | "blocked";     // out of order — not a booking at all

export interface TapeBar {
  reservationId: string;
  guestName: string;
  /** Inclusive first night shown, `YYYY-MM-DD`, clipped to the visible window. */
  from: string;
  /** Inclusive last night shown. A stay's departure day is not a night it occupies. */
  to: string;
  nights: number;
  status: BarStatus;
  /** A human picked this room, so the optimiser will not move it (§2.3). */
  pinned: boolean;
  /** True when the bar is cut off by the window rather than actually starting/ending here. */
  continuesLeft: boolean;
  continuesRight: boolean;
  balanceMinor: number | null;
}

export interface TapeRow {
  unitId: string;
  label: string;
  floor: string | null;
  roomTypeId: string;
  roomTypeName: string;
  hkStatus: HkStatus;
  bars: TapeBar[];
}

export interface TapeDay {
  date: string;
  /** Weekend shading is not decoration — occupancy patterns are weekly and the eye needs the anchor. */
  weekend: boolean;
  today: boolean;
  occupiedRooms: number;
  availableRooms: number;
  occupancyPct: number;
}

const DEFAULT_WINDOW_DAYS = 30;

export async function getTapeChart(opts: { from?: string; days?: number } = {}) {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);
  const from = opts.from ?? today;
  // Legibility beats span (§2.2): a window wide enough to be unreadable helps nobody, so the range
  // is capped rather than letting a URL ask for a year of columns.
  const days = Math.min(90, Math.max(7, opts.days ?? DEFAULT_WINDOW_DAYS));
  const to = addDaysYmd(from, days);

  const [units, assignments] = await Promise.all([
    prisma.unit.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: [{ floor: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      include: { roomType: { select: { id: true, name: true } } },
    }),
    // Overlap, not containment: a stay that started before the window and ends inside it still
    // occupies rooms we are drawing, and leaving it out would show those nights as sellable.
    prisma.roomAssignment.findMany({
      where: {
        propertyId: property.id,
        status: { in: ["active"] },
        checkIn: { lt: new Date(`${to}T00:00:00Z`) },
        checkOut: { gt: new Date(`${from}T00:00:00Z`) },
        reservation: { status: { notIn: ["cancelled"] } },
      },
      include: {
        unit: { select: { id: true } },
        reservation: {
          select: {
            id: true, guestName: true, departedAt: true,
            guest: { select: { firstName: true, lastName: true } },
            folios: { select: { lines: { select: { kind: true, amountMinor: true, voided: true } } } },
          },
        },
      },
    }),
  ]);

  const dates: string[] = [];
  for (let i = 0; i < days; i++) dates.push(addDaysYmd(from, i));

  const barsByUnit = new Map<string, TapeBar[]>();
  for (const a of assignments) {
    const r = a.reservation;
    const stayFrom = ymd(a.checkIn);
    // The departure DAY is not a night. A 3→6 August stay occupies the 3rd, 4th and 5th, and drawing
    // it through the 6th would show the room as busy on a day it is sellable again.
    const lastNight = addDaysYmd(ymd(a.checkOut), -1);

    const clippedFrom = stayFrom < from ? from : stayFrom;
    const clippedTo = lastNight > dates[dates.length - 1]! ? dates[dates.length - 1]! : lastNight;
    if (clippedTo < clippedFrom) continue; // entirely outside the window after clipping

    const balance = r.folios.length
      ? r.folios.reduce(
          (s, f) => s + f.lines.reduce((t, l) => (l.voided ? t : l.kind === "payment" ? t - l.amountMinor : t + l.amountMinor), 0),
          0,
        )
      : null;

    barsByUnit.set(a.unitId, [
      ...(barsByUnit.get(a.unitId) ?? []),
      {
        reservationId: r.id,
        guestName: r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName,
        from: clippedFrom,
        to: clippedTo,
        nights: dateDiff(clippedFrom, clippedTo) + 1,
        status: barStatus(a, r.departedAt, today, stayFrom, lastNight),
        pinned: a.pinned,
        continuesLeft: stayFrom < from,
        continuesRight: lastNight > dates[dates.length - 1]!,
        balanceMinor: balance,
      },
    ]);
  }

  const rows: TapeRow[] = units.map((u) => ({
    unitId: u.id,
    label: u.label,
    floor: u.floor,
    roomTypeId: u.roomType.id,
    roomTypeName: u.roomType.name,
    hkStatus: u.hkStatus as HkStatus,
    bars: (barsByUnit.get(u.id) ?? []).sort((a, b) => a.from.localeCompare(b.from)),
  }));

  // The insight layer (§2.1): the shape above, the numbers below. Occupancy per day is the question
  // the grid is usually opened to answer, and counting bars by eye is how people get it wrong.
  const days_: TapeDay[] = dates.map((date) => {
    let occupied = 0;
    for (const row of rows) {
      if (row.bars.some((b) => b.from <= date && date <= b.to)) occupied++;
    }
    return {
      date,
      weekend: [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()),
      today: date === today,
      occupiedRooms: occupied,
      availableRooms: rows.length - occupied,
      occupancyPct: rows.length > 0 ? Math.round((occupied / rows.length) * 1000) / 10 : 0,
    };
  });

  return { property, today, from, days, dates, rows, tapeDays: days_ };
}

function dateDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function barStatus(
  a: { checkedInAt: Date | null; checkedOutAt: Date | null },
  departedAt: Date | null,
  today: string,
  stayFrom: string,
  lastNight: string,
): BarStatus {
  if (departedAt || a.checkedOutAt) return "confirmed"; // drawn as history, not as occupancy
  if (a.checkedInAt) {
    if (lastNight < today) return "overstayed";
    if (lastNight === today) return "due_out";
    return "in_house";
  }
  if (stayFrom === today) return "arrival";
  return "confirmed";
}
