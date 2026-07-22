"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSession } from "./session";
import { logAudit, recordSync, str, int, utcDay } from "./mutation-helpers";
import { recordOpsEvent } from "./events";
import { todayInTz, addDaysYmd } from "./format";

const HK_STATUSES = ["clean", "dirty", "in_progress", "inspected", "out_of_order"];

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  return session;
}

function refresh() {
  revalidatePath("/rooms");
  revalidatePath("/housekeeping");
  revalidatePath("/dashboard");
}

/** Add one physical unit under a room type. */
export async function createUnit(fd: FormData): Promise<void> {
  const session = await ctx();
  const roomTypeId = str(fd, "roomTypeId");
  const label = str(fd, "label");
  const floor = str(fd, "floor") || null;
  if (!roomTypeId || !label) return;

  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType || roomType.propertyId !== session.activePropertyId) return;

  const count = await prisma.unit.count({ where: { roomTypeId } });
  await prisma.unit.create({
    data: {
      tenantId: session.tenantId,
      propertyId: session.activePropertyId,
      roomTypeId,
      label,
      unitKind: roomType.unitKind,
      floor,
      sortOrder: count,
    },
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "unit", field: "create", newValue: label, userId: session.userId });
  refresh();
}

/** Bulk-generate numbered units (e.g. 101…110) under a room type. */
export async function generateUnits(fd: FormData): Promise<void> {
  const session = await ctx();
  const roomTypeId = str(fd, "roomTypeId");
  const n = Math.min(200, Math.max(1, int(fd, "count", 0)));
  const start = int(fd, "start", 1);
  const prefix = str(fd, "prefix");
  const floor = str(fd, "floor") || null;
  if (!roomTypeId || n <= 0) return;

  const roomType = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
  if (!roomType || roomType.propertyId !== session.activePropertyId) return;

  const existing = await prisma.unit.count({ where: { roomTypeId } });
  const data = Array.from({ length: n }, (_, i) => ({
    tenantId: session.tenantId,
    propertyId: session.activePropertyId,
    roomTypeId,
    label: `${prefix}${start + i}`,
    unitKind: roomType.unitKind,
    floor,
    sortOrder: existing + i,
  }));
  await prisma.unit.createMany({ data });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "unit", field: "generate", newValue: `${n} units`, userId: session.userId });
  refresh();
}

const UNIT_FEATURES = ["quiet", "accessible", "view", "smoking"];

/** Edit a unit's label / floor / active flag + assignment attributes (features, connecting rooms).
 * Connecting-room links are kept SYMMETRIC (both units list each other) because the one-room-in-
 * progress rule and family/group assignment read them from either side (spec §3.5). */
export async function updateUnit(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;

  const features = fd.getAll("features").map(String).filter((f) => UNIT_FEATURES.includes(f));
  const requested = fd.getAll("connecting").map(String).filter(Boolean);
  // Only allow connecting to real units at the same property (never to self).
  const valid = requested.length
    ? await prisma.unit.findMany({ where: { id: { in: requested }, propertyId: unit.propertyId, NOT: { id: unitId } }, select: { id: true } })
    : [];
  const nextConnecting = valid.map((u) => u.id);

  await prisma.unit.update({
    where: { id: unitId },
    data: {
      label: str(fd, "label") || unit.label,
      floor: str(fd, "floor") || null,
      active: fd.get("active") != null,
      features,
      connectingUnitIds: nextConnecting,
    },
  });

  // Maintain symmetry: add this unit to newly-linked partners, remove from dropped ones.
  const before = new Set(unit.connectingUnitIds);
  const after = new Set(nextConnecting);
  const added = nextConnecting.filter((id) => !before.has(id));
  const removed = unit.connectingUnitIds.filter((id) => !after.has(id));
  for (const id of added) {
    const partner = await prisma.unit.findUnique({ where: { id }, select: { connectingUnitIds: true } });
    if (partner && !partner.connectingUnitIds.includes(unitId)) {
      await prisma.unit.update({ where: { id }, data: { connectingUnitIds: [...partner.connectingUnitIds, unitId] } });
    }
  }
  for (const id of removed) {
    const partner = await prisma.unit.findUnique({ where: { id }, select: { connectingUnitIds: true } });
    if (partner) await prisma.unit.update({ where: { id }, data: { connectingUnitIds: partner.connectingUnitIds.filter((x) => x !== unitId) } });
  }

  await logAudit(unit.propertyId, session.tenantId, { entity: "unit", field: "edit", newValue: str(fd, "label"), userId: session.userId });
  refresh();
}

/**
 * Remove a unit (cascades its OOO period, restoring the room to sale). DELETION GUARD (spec §3.5):
 * a room that is occupied, assigned, or has a future reservation cannot be deleted — WARN rather
 * than fail silently, so the user learns why.
 */
export async function deleteUnit(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;

  // Blocked if a guest is in it now OR it's assigned to any current/future stay (active, not yet
  // checked out) — deleting would cascade away a live stay record.
  const held = await prisma.roomAssignment.count({ where: { unitId, status: "active", checkedOutAt: null } });
  if (held > 0) {
    revalidatePath("/rooms");
    redirect(`/rooms?blocked=${encodeURIComponent(unit.label)}`);
  }

  // Clean up symmetric connecting links pointing back at this unit before deleting.
  for (const id of unit.connectingUnitIds) {
    const partner = await prisma.unit.findUnique({ where: { id }, select: { connectingUnitIds: true } });
    if (partner) await prisma.unit.update({ where: { id }, data: { connectingUnitIds: partner.connectingUnitIds.filter((x) => x !== unitId) } });
  }
  await prisma.unit.delete({ where: { id: unitId } });
  await logAudit(unit.propertyId, session.tenantId, { entity: "unit", field: "delete", oldValue: unit.label, userId: session.userId });
  refresh();
}

/**
 * Change a unit's housekeeping status. THE one cross-product write: marking a unit `out_of_order`
 * writes a RoomInventoryPeriod (kind=out_of_order, unitId set) so the shared availability waterfall
 * takes that room off sale on every channel; moving it back to any serviceable status deletes the
 * period, restoring the room. (docs/PMS-REFERENCE.md "Housekeeping status model".)
 */
export async function setUnitStatus(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const status = str(fd, "status");
  if (!HK_STATUSES.includes(status)) return;

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;
  const prev = unit.hkStatus;
  if (prev === status) return;

  await prisma.unit.update({ where: { id: unitId }, data: { hkStatus: status } });

  if (status === "out_of_order" && prev !== "out_of_order") {
    const property = await prisma.property.findUnique({ where: { id: unit.propertyId } });
    const today = todayInTz(property!.timezone);
    const to = addDaysYmd(today, property!.syncHorizonDays);
    await prisma.roomInventoryPeriod.create({
      data: {
        tenantId: session.tenantId,
        propertyId: unit.propertyId,
        roomTypeId: unit.roomTypeId,
        kind: "out_of_order",
        dateFrom: utcDay(today),
        dateTo: utcDay(to),
        rooms: 1,
        unitId: unit.id,
        note: `Unit ${unit.label} out of order (PMS)`,
      },
    });
    const rt = await prisma.roomType.findUnique({ where: { id: unit.roomTypeId } });
    await recordSync(unit.propertyId, session.tenantId, `Availability reduced — ${rt?.name ?? "1 room"}`, "1 room off sale until back in service");
  } else if (prev === "out_of_order" && status !== "out_of_order") {
    await prisma.roomInventoryPeriod.deleteMany({ where: { unitId: unit.id } });
    const rt = await prisma.roomType.findUnique({ where: { id: unit.roomTypeId } });
    await recordSync(unit.propertyId, session.tenantId, `Availability restored — ${rt?.name ?? "1 room"}`, "1 room returned to sale");
  }

  await logAudit(unit.propertyId, session.tenantId, { entity: "unit_status", field: unit.label, oldValue: prev, newValue: status, userId: session.userId });
  // Ops event stream (J0 §6.8/§7.4): a supervisor moving clean → inspected is an inspection pass.
  await recordOpsEvent({
    propertyId: unit.propertyId, tenantId: session.tenantId, domain: "housekeeping",
    action: prev === "clean" && status === "inspected" ? "inspection_pass" : "status_change",
    unitId: unit.id, actorId: session.userId,
    fromState: prev, toState: status === "inspected" ? "ready" : status,
  });
  refresh();
}

/**
 * Start cleaning a room (dirty → in_progress) with the ONE-ROOM-IN-PROGRESS rule (spec §3.4): a
 * housekeeper may have only one room in progress at a time, because they clean one room at a time and
 * allowing several lets statuses be gamed and blinds the supervisor. The only exception is CONNECTING
 * rooms (physically one job). Attempting to start a second, non-connected room is BLOCKED with a
 * message — the block is what enforces the discipline. (A desktop supervisor uses the free status
 * select, which is unconstrained; per-user role scoping formalizes in D8.)
 */
export async function startCleaning(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;

  const inProgress = await prisma.unit.findMany({
    where: { propertyId: session.activePropertyId, hkStatus: "in_progress", id: { not: unitId } },
    select: { id: true, label: true },
  });
  const connecting = new Set(unit.connectingUnitIds);
  const blocker = inProgress.find((u) => !connecting.has(u.id));
  if (blocker) {
    revalidatePath("/housekeeping");
    redirect(`/housekeeping?blocked=${encodeURIComponent(blocker.label)}`);
  }

  await prisma.unit.update({ where: { id: unitId }, data: { hkStatus: "in_progress" } });
  await logAudit(unit.propertyId, session.tenantId, { entity: "unit_status", field: unit.label, oldValue: unit.hkStatus, newValue: "in_progress", userId: session.userId });
  // The cleaner who starts a room is the one measured for its clean time (J0 analytics §6.8).
  await recordOpsEvent({
    propertyId: unit.propertyId, tenantId: session.tenantId, domain: "housekeeping",
    action: "status_change", unitId: unit.id, userId: session.userId, actorId: session.userId,
    fromState: unit.hkStatus, toState: "in_progress",
  });
  refresh();
}

/** Finish cleaning (in_progress → clean). Under the inspection gate `clean` is "cleaned, pending
 * inspection" (not sellable) until a supervisor approves; off, it's directly sellable (spec §3.4). */
export async function finishCleaning(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;
  await prisma.unit.update({ where: { id: unitId }, data: { hkStatus: "clean" } });
  await logAudit(unit.propertyId, session.tenantId, { entity: "unit_status", field: unit.label, oldValue: unit.hkStatus, newValue: "clean", userId: session.userId });
  // Finishing a clean lands in "awaiting inspection" when the property gates on inspection, else straight
  // to "ready" (J0 pipeline vocab §6.3) — closes the clean-time measurement started at startCleaning.
  const defs = await prisma.propertyDefaults.findUnique({ where: { propertyId: unit.propertyId }, select: { inspectionGate: true } });
  await recordOpsEvent({
    propertyId: unit.propertyId, tenantId: session.tenantId, domain: "housekeeping",
    action: "status_change", unitId: unit.id, userId: session.userId, actorId: session.userId,
    fromState: unit.hkStatus, toState: defs?.inspectionGate ? "awaiting_inspection" : "ready",
  });
  refresh();
}

/** Report-an-issue from housekeeping (spec §3.4): a cleaner flags damage/a fault → a Maintenance
 * task, linked to the room. Photo attachment arrives in D7. */
export async function reportRoomIssue(fd: FormData): Promise<void> {
  const session = await ctx();
  const unitId = str(fd, "unitId");
  const title = str(fd, "title");
  if (!title) return;
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.propertyId !== session.activePropertyId) return;

  await prisma.maintenanceTask.create({
    data: {
      tenantId: session.tenantId, propertyId: session.activePropertyId, unitId,
      title, status: "open", priority: "normal", createdById: session.userId,
    },
  });
  await logAudit(unit.propertyId, session.tenantId, { entity: "maintenance_reported", field: unit.label, newValue: title, userId: session.userId });
  revalidatePath("/housekeeping");
  revalidatePath("/maintenance");
}
