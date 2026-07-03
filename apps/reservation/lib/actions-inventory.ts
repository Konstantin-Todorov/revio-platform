"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { logAudit, recordPush, str, int, utcDay } from "./mutation-helpers";

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/setup");
  revalidatePath("/dashboard");
}

export async function addInventoryPeriod(fd: FormData): Promise<void> {
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
  await recordPush(propertyId, tenantId, `${label} period added — ${roomType.name} availability reduced`);
  revalidateInventory();
}

export async function deleteInventoryPeriod(fd: FormData): Promise<void> {
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
  await recordPush(propertyId, tenantId, `${period.kind === "closure" ? "Closure" : "Out of order"} period removed — ${period.roomType.name} availability restored`);
  revalidateInventory();
}
