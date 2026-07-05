import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { ymd, todayInTz } from "./format";
import { folioBalance } from "./folio";

const OCCUPYING = ["confirmed", "modified"];

export interface CloseDayRow {
  reservationId: string;
  guestName: string;
  detail: string;
}

/**
 * The night-audit preview: the current business date + what's outstanding — un-arrived reservations that
 * would become no-shows, in-house guests past their check-out date, and open folios with a balance.
 */
export async function getCloseDayView() {
  const { property } = await activeProperty();
  const today = todayInTz(property.timezone);
  const businessDate = property.businessDate ? ymd(property.businessDate) : today;

  const reservations = await prisma.reservation.findMany({
    where: { propertyId: property.id, status: { in: OCCUPYING } },
    include: { lines: { include: { roomType: { select: { name: true } } } }, guest: true, assignments: { include: { unit: { select: { label: true } } } } },
  });

  const noShowCandidates: CloseDayRow[] = [];
  const dueOutStillIn: CloseDayRow[] = [];

  for (const r of reservations) {
    if (r.lines.length === 0) continue;
    const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
    const ci = ymd(r.lines.map((l) => l.checkIn).sort((a, b) => a.getTime() - b.getTime())[0]!);
    const co = ymd(r.lines.map((l) => l.checkOut).sort((a, b) => b.getTime() - a.getTime())[0]!);
    const everCheckedIn = r.assignments.length > 0; // any assignment (active/moved/departed) = they arrived
    const active = r.assignments.filter((a) => a.status === "active" && a.checkedOutAt == null);

    if (!everCheckedIn && ci <= businessDate) {
      noShowCandidates.push({ reservationId: r.id, guestName, detail: `${r.lines[0]!.roomType.name} · arrival ${ci}` });
    }
    if (active.length > 0 && co <= businessDate) {
      dueOutStillIn.push({ reservationId: r.id, guestName, detail: `Room ${active.map((a) => a.unit.label).join(", ")} · due out ${co}` });
    }
  }

  const folios = await prisma.folio.findMany({
    where: { propertyId: property.id, status: "open" },
    include: { lines: true, reservation: { include: { guest: true } } },
  });
  const unsettled = folios
    .map((f) => {
      const r = f.reservation;
      const guestName = r.guest ? `${r.guest.firstName} ${r.guest.lastName}`.trim() : r.guestName;
      return { reservationId: f.reservationId, guestName, balance: folioBalance(f.lines).balance, currency: f.currency };
    })
    .filter((x) => x.balance !== 0);

  return { property, today, businessDate, noShowCandidates, dueOutStillIn, unsettled };
}
