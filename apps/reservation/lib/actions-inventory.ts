"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { stayScope } from "@revio/connectivity";
import { logAudit, recordPush, str, int, utcDay } from "./mutation-helpers";
import { requireCapability } from "./authz";

/** An inventory period's `dateTo` is the last CLOSED day; `stayScope` wants a check-out date. */
function addDay(ymd: string): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
}

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/setup");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
  /*
   * Y2 — drop the CLIENT router cache for EVERY route under this layout, not just the ones named
   * above.
   *
   * Reported as "other pages are blocked and do not work, sometimes you have to reload". The cause
   * is Next's client-side Router Cache: a page you have already visited is served from memory on the
   * next navigation, and `revalidatePath("/calendar")` only clears the entry it names. So a change
   * made on one screen left every OTHER screen showing the value from before it — and screens no
   * action mentioned at all (RevioLink's /bulk-update and /users, RevioCRS's /reports, RevioPMS's
   * /settings and /walkin) were never cleared by anything.
   *
   * The named paths above stay, because they document what this mutation actually touches. This one
   * line is the safety net: `"layout"` clears the whole subtree, so no screen can be left behind by
   * an action that forgot to list it.
   */
  revalidatePath("/", "layout");
}

export async function addInventoryPeriod(fd: FormData): Promise<void> {
  await requireCapability("manageInventory");
  const { id: propertyId, tenantId } = await getProperty();

  const roomTypeId = str(fd, "roomTypeId");
  const kind = str(fd, "kind") === "closure" ? "closure" : "out_of_order";
  const dateFrom = str(fd, "dateFrom");
  const dateTo = str(fd, "dateTo");
  const note = str(fd, "note") || null;
  if (!roomTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateTo < dateFrom) return;

  const roomType = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId } });
  if (!roomType) return;
  const rooms = Math.min(Math.max(int(fd, "rooms", 1), 1), roomType.totalRooms);

  await prisma.roomInventoryPeriod.create({
    data: { tenantId, propertyId, roomTypeId, kind, dateFrom: utcDay(dateFrom), dateTo: utcDay(dateTo), rooms, note },
  });

  const label = kind === "closure" ? "Closure" : "Out of order";
  await logAudit(propertyId, tenantId, {
    entity: `Inventory · ${roomType.name}`,
    field: label,
    newValue: `${dateFrom} → ${dateTo} · ${rooms} ${roomType.unitKind === "bed" ? "beds" : "rooms"}`,
  });
  await recordPush(propertyId, tenantId, `${label} period added — ${roomType.name} availability reduced`,
    // dateTo is inclusive; stayScope treats the end as a check-out, so add the extra day.
    stayScope([{ roomTypeId, checkIn: dateFrom, checkOut: addDay(dateTo) }]));
  revalidateInventory();
}

export async function deleteInventoryPeriod(fd: FormData): Promise<void> {
  await requireCapability("manageInventory");
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");

  const period = await prisma.roomInventoryPeriod.findFirst({
    where: { id, propertyId },
    include: { roomType: { select: { name: true } } },
  });
  if (!period) return;

  await prisma.roomInventoryPeriod.delete({ where: { id } });
  await logAudit(propertyId, tenantId, {
    entity: `Inventory · ${period.roomType.name}`,
    field: period.kind === "closure" ? "Closure removed" : "Out of order removed",
    oldValue: `${period.dateFrom.toISOString().slice(0, 10)} → ${period.dateTo.toISOString().slice(0, 10)}`,
  });
  await recordPush(propertyId, tenantId, `${period.kind === "closure" ? "Closure" : "Out of order"} period removed — ${period.roomType.name} availability restored`,
    stayScope([{ roomTypeId: period.roomTypeId, checkIn: period.dateFrom, checkOut: addDay(period.dateTo.toISOString().slice(0, 10)) }]));
  revalidateInventory();
}
