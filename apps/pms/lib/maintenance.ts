import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";

/** Maintenance tasks + the active units (for the create form). */
export async function getMaintenanceBoard() {
  const { property } = await activeProperty();
  const [tasks, units] = await Promise.all([
    prisma.maintenanceTask.findMany({
      where: { propertyId: property.id },
      orderBy: [{ createdAt: "desc" }],
      include: { unit: { select: { id: true, label: true, roomType: { select: { name: true } } } } },
    }),
    prisma.unit.findMany({ where: { propertyId: property.id, active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { id: true, label: true } }),
  ]);
  return { property, tasks, units };
}

export interface RoomEvent { at: Date; label: string; detail?: string; kind: "clean" | "in_progress" | "inspected" | "ooo" | "issue" | "repaired" | "guest" | "other" }

/**
 * Room lifecycle timeline (spec §3.8) — the industry-gap feature. Per-room history assembled from
 * housekeeping status changes (audit log), maintenance tasks (reported / OOO / repaired) and guest
 * moves, so a manager sees "cleaned → issue reported → OOO → repaired → back in service" in one place.
 * Pairs with the reservation timeline (§3.2).
 */
export async function getRoomTimeline(unitId: string) {
  const { property } = await activeProperty();
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, propertyId: property.id },
    include: { roomType: { select: { name: true } } },
  });
  if (!unit) return null;

  const [tasks, statusAudit, assignments] = await Promise.all([
    prisma.maintenanceTask.findMany({ where: { propertyId: property.id, unitId }, orderBy: { createdAt: "asc" } }),
    // Housekeeping status changes are logged with field = the unit's label (unique within a property).
    prisma.auditEntry.findMany({
      where: { propertyId: property.id, entity: { in: ["unit_status", "maintenance_reported"] }, field: unit.label },
      orderBy: { createdAt: "asc" },
    }),
    prisma.roomAssignment.findMany({
      where: { propertyId: property.id, unitId },
      include: { reservation: { select: { guestName: true, guest: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const HK: Record<string, RoomEvent["kind"]> = { clean: "clean", in_progress: "in_progress", inspected: "inspected", dirty: "other", out_of_order: "ooo" };
  const HK_TXT: Record<string, string> = { clean: "Cleaned", in_progress: "Cleaning started", inspected: "Inspected", dirty: "Marked dirty", out_of_order: "Out of order (housekeeping)" };

  const events: RoomEvent[] = [];
  for (const a of statusAudit) {
    if (a.entity === "maintenance_reported") { events.push({ at: a.createdAt, label: "Issue reported (housekeeping)", detail: a.newValue ?? undefined, kind: "issue" }); continue; }
    const st = a.newValue ?? "";
    events.push({ at: a.createdAt, label: HK_TXT[st] ?? `Status → ${st}`, kind: HK[st] ?? "other" });
  }
  for (const t of tasks) {
    events.push({ at: t.createdAt, label: `Issue logged: ${t.title}`, detail: t.setsOoo ? "took the room out of order" : `priority ${t.priority}`, kind: "issue" });
    if (t.completedAt) events.push({ at: t.completedAt, label: `Repaired: ${t.title}`, detail: "back in service", kind: "repaired" });
  }
  for (const a of assignments) {
    const name = a.reservation.guest ? `${a.reservation.guest.firstName} ${a.reservation.guest.lastName}`.trim() : a.reservation.guestName;
    if (a.checkedInAt) events.push({ at: a.checkedInAt, label: `${name} checked in`, kind: "guest" });
    if (a.checkedOutAt) events.push({ at: a.checkedOutAt, label: `${name} checked out`, kind: "guest" });
  }
  events.sort((x, y) => x.at.getTime() - y.at.getTime());

  return { property, unit: { id: unit.id, label: unit.label, floor: unit.floor, hkStatus: unit.hkStatus, roomType: unit.roomType.name }, events };
}
