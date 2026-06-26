"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { logAudit, recordPush, str, int } from "./mutation-helpers";

export type ActionResult = { ok: boolean; error?: string };

// --- Room Types ------------------------------------------------------------

export async function saveRoomType(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const property = await getProperty();
  const { id, tenantId } = property;
  const propertyId = id;

  const name = str(fd, "name");
  const code = str(fd, "code").toUpperCase();
  const rowId = str(fd, "id");
  if (!name) return { ok: false, error: "Name is required." };
  if (!code) return { ok: false, error: "Code is required." };

  const totalInventory = Math.max(0, int(fd, "totalInventory"));
  const maxGuests = Math.max(1, int(fd, "maxGuests", 1));
  const unitKind = str(fd, "unitKind") || "room";
  const active = fd.get("active") != null;
  const description = str(fd, "description") || null;

  // Code must be unique within the property.
  const clash = await prisma.roomType.findFirst({
    where: { propertyId, code, ...(rowId ? { id: { not: rowId } } : {}) },
  });
  if (clash) return { ok: false, error: `Code "${code}" is already used by another room type.` };

  if (rowId) {
    const before = await prisma.roomType.findUnique({ where: { id: rowId } });
    await prisma.roomType.update({
      where: { id: rowId },
      data: { name, code, unitKind, totalInventory, maxGuests, description, active },
    });
    await logAudit(propertyId, tenantId, {
      entity: `Room Type · ${name}`, field: "edit",
      oldValue: before ? `${before.name} (${before.totalInventory})` : undefined,
      newValue: `${name} (${totalInventory})`,
    });
    await recordPush(propertyId, tenantId, `Room type "${name}" updated`);
  } else {
    const count = await prisma.roomType.count({ where: { propertyId } });
    const created = await prisma.roomType.create({
      data: { tenantId, propertyId, name, code, unitKind, totalInventory, maxGuests, description, active, sortOrder: count },
    });
    // A new room type becomes sellable under every existing rate plan (room × rate = product).
    const plans = await prisma.ratePlan.findMany({ where: { propertyId }, select: { id: true } });
    if (plans.length) {
      await prisma.ratePlanRoomType.createMany({ data: plans.map((p) => ({ ratePlanId: p.id, roomTypeId: created.id })) });
    }
    await logAudit(propertyId, tenantId, { entity: `Room Type · ${name}`, field: "create", newValue: `${name} · ${totalInventory} units` });
    await recordPush(propertyId, tenantId, `Room type "${name}" created`);
  }

  revalidatePath("/rooms-rates");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteRoomType(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  if (!id) return;

  // Guard: never destroy a room type that has real reservations behind it.
  const resCount = await prisma.reservationLine.count({ where: { roomTypeId: id } });
  const rt = await prisma.roomType.findUnique({ where: { id } });
  if (!rt) return;

  if (resCount > 0) {
    // Soft-delete: deactivate instead of breaking booking history.
    await prisma.roomType.update({ where: { id }, data: { active: false } });
    await logAudit(property.id, property.tenantId, { entity: `Room Type · ${rt.name}`, field: "deactivate", newValue: "inactive (has reservations)" });
  } else {
    await prisma.roomType.delete({ where: { id } }); // cascades prices, cells, mappings, links
    await logAudit(property.id, property.tenantId, { entity: `Room Type · ${rt.name}`, field: "delete", oldValue: rt.name });
    await recordPush(property.id, property.tenantId, `Room type "${rt.name}" removed`);
  }
  revalidatePath("/rooms-rates");
  revalidatePath("/calendar");
}

// --- Rate Plans ------------------------------------------------------------

export async function saveRatePlan(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;

  const name = str(fd, "name");
  const code = str(fd, "code").toUpperCase();
  const rowId = str(fd, "id");
  if (!name) return { ok: false, error: "Name is required." };
  if (!code) return { ok: false, error: "Code is required." };

  const tags = str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean);
  const priceLogic = str(fd, "priceLogic") || "manual";
  const active = fd.get("active") != null;

  // Derived config (only when derived).
  const derived =
    priceLogic === "derived"
      ? {
          parentRatePlanId: str(fd, "parentRatePlanId") || null,
          derivedType: str(fd, "derivedType") || "percent",
          derivedDirection: str(fd, "derivedDirection") || "decrease",
          derivedValue: Math.max(0, int(fd, "derivedValue")),
          derivedRounding: str(fd, "derivedRounding") || "none",
        }
      : { parentRatePlanId: null, derivedType: null, derivedDirection: null, derivedValue: null, derivedRounding: null };

  if (priceLogic === "derived" && !derived.parentRatePlanId) {
    return { ok: false, error: "A derived rate needs a parent rate plan." };
  }

  const clash = await prisma.ratePlan.findFirst({ where: { propertyId, code, ...(rowId ? { id: { not: rowId } } : {}) } });
  if (clash) return { ok: false, error: `Code "${code}" is already used by another rate plan.` };

  if (rowId) {
    await prisma.ratePlan.update({ where: { id: rowId }, data: { name, code, tags, priceLogic, active, ...derived } });
    await logAudit(propertyId, tenantId, { entity: `Rate Plan · ${name}`, field: "edit", newValue: name });
    await recordPush(propertyId, tenantId, `Rate plan "${name}" updated`);
  } else {
    const count = await prisma.ratePlan.count({ where: { propertyId } });
    const rp = await prisma.ratePlan.create({
      data: { tenantId, propertyId, name, code, tags, priceLogic, active, sortOrder: count, ...derived },
    });
    // Link to all room types by default (a sellable product per room type).
    const roomTypes = await prisma.roomType.findMany({ where: { propertyId } });
    await prisma.ratePlanRoomType.createMany({ data: roomTypes.map((rt) => ({ ratePlanId: rp.id, roomTypeId: rt.id })) });
    await logAudit(propertyId, tenantId, { entity: `Rate Plan · ${name}`, field: "create", newValue: name });
    await recordPush(propertyId, tenantId, `Rate plan "${name}" created`);
  }

  revalidatePath("/rooms-rates");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteRatePlan(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  if (!id) return;

  const rp = await prisma.ratePlan.findUnique({ where: { id }, include: { _count: { select: { children: true, resLines: true } } } });
  if (!rp) return;

  // Guard: can't delete a parent that other rates derive from, or one with reservations.
  if (rp._count.children > 0) {
    await prisma.ratePlan.update({ where: { id }, data: { active: false } });
    await logAudit(property.id, property.tenantId, { entity: `Rate Plan · ${rp.name}`, field: "deactivate", newValue: "inactive (has derived rates)" });
  } else if (rp._count.resLines > 0) {
    await prisma.ratePlan.update({ where: { id }, data: { active: false } });
    await logAudit(property.id, property.tenantId, { entity: `Rate Plan · ${rp.name}`, field: "deactivate", newValue: "inactive (has reservations)" });
  } else {
    await prisma.ratePlan.delete({ where: { id } });
    await logAudit(property.id, property.tenantId, { entity: `Rate Plan · ${rp.name}`, field: "delete", oldValue: rp.name });
    await recordPush(property.id, property.tenantId, `Rate plan "${rp.name}" removed`);
  }
  revalidatePath("/rooms-rates");
  revalidatePath("/calendar");
}
