import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { ensureFolio, folioBalance } from "./folio";

/** The full catalog (both categories, incl. inactive) for the management screen. */
export async function getCatalog() {
  const { property } = await activeProperty();
  const items = await prisma.posItem.findMany({
    where: { propertyId: property.id },
    orderBy: [{ outlet: "asc" }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return { property, items };
}

/** Everything the tap-to-post screen needs for one stay: guest/room, active catalog, folio + what's already posted. */
export async function getMinibarBoard(reservationId: string) {
  const { session, property } = await activeProperty();
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: property.id },
    include: { guest: true, assignments: { where: { status: "active", checkedOutAt: null }, include: { unit: { select: { label: true } } } } },
  });
  if (!reservation) return null;

  await ensureFolio(session.tenantId, property.id, reservationId);
  const [items, folio] = await Promise.all([
    prisma.posItem.findMany({ where: { propertyId: property.id, active: true }, orderBy: [{ outlet: "asc" }, { category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    // Tap-to-post lands on the PRIMARY (guest) folio; split/company folios are handled on the bill.
    prisma.folio.findFirst({ where: { reservationId, isPrimary: true }, include: { lines: { orderBy: { postedAt: "desc" } } } }),
  ]);
  if (!folio) return null;

  const posted = folio.lines.filter((l) => (l.kind === "minibar" || l.kind === "extra") && !l.voided);
  return { property, reservation, items, folio, posted, totals: folioBalance(folio.lines) };
}
