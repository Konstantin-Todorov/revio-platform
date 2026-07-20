"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  const totalRooms = Math.max(0, int(fd, "totalRooms"));
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
      data: { name, code, unitKind, totalRooms, maxGuests, description, active },
    });
    await logAudit(propertyId, tenantId, {
      entity: `Room Type · ${name}`, field: "edit",
      oldValue: before ? `${before.name} (${before.totalRooms})` : undefined,
      newValue: `${name} (${totalRooms})`,
    });
    await recordPush(propertyId, tenantId, `Room type "${name}" updated`);
  } else {
    const count = await prisma.roomType.count({ where: { propertyId } });
    const created = await prisma.roomType.create({
      data: { tenantId, propertyId, name, code, unitKind, totalRooms, maxGuests, description, active, sortOrder: count },
    });
    // A new room type becomes sellable under every existing rate plan (room × rate = product).
    const plans = await prisma.ratePlan.findMany({ where: { propertyId }, select: { id: true } });
    if (plans.length) {
      await prisma.ratePlanRoomType.createMany({ data: plans.map((p) => ({ ratePlanId: p.id, roomTypeId: created.id })) });
    }
    await logAudit(propertyId, tenantId, { entity: `Room Type · ${name}`, field: "create", newValue: `${name} · ${totalRooms} units` });
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

  const rt = await prisma.roomType.findUnique({ where: { id } });
  if (!rt) return;

  // Guard (spec §3.4): a product mapped to a channel cannot be deleted at the Channex level —
  // require unmapping first instead of letting the call fail downstream.
  const mapped = await prisma.channelRoomTypeMapping.count({ where: { roomTypeId: id, externalRoomId: { not: null } } });
  if (mapped > 0) {
    redirect(`/rooms-rates?blocked=${encodeURIComponent(rt.name)}&kind=room`);
  }

  // Guard: never destroy a room type that has real reservations behind it.
  const resCount = await prisma.reservationLine.count({ where: { roomTypeId: id } });
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

  // Rate-plan-level restrictions (blank field = no rule → null). Min/Max stay apply to all dates;
  // advance-purchase min/max drive the rolling auto-close computed in @revio/core.
  const optInt = (key: string): number | null => {
    const v = str(fd, key);
    if (v === "") return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const restrictions = {
    defMinLos: optInt("defMinLos"),
    defMaxLos: optInt("defMaxLos"),
    defAdvancePurchaseMin: optInt("defAdvancePurchaseMin"),
    defAdvancePurchaseMax: optInt("defAdvancePurchaseMax"),
  };

  const clash = await prisma.ratePlan.findFirst({ where: { propertyId, code, ...(rowId ? { id: { not: rowId } } : {}) } });
  if (clash) return { ok: false, error: `Code "${code}" is already used by another rate plan.` };

  if (rowId) {
    await prisma.ratePlan.update({ where: { id: rowId }, data: { name, code, tags, priceLogic, active, ...derived, ...restrictions } });
    await logAudit(propertyId, tenantId, { entity: `Rate Plan · ${name}`, field: "edit", newValue: name });
    await recordPush(propertyId, tenantId, `Rate plan "${name}" updated`);
  } else {
    const count = await prisma.ratePlan.count({ where: { propertyId } });
    const rp = await prisma.ratePlan.create({
      data: { tenantId, propertyId, name, code, tags, priceLogic, active, sortOrder: count, ...derived, ...restrictions },
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

  // Guard (spec §3.4): mapped rate plans must be unmapped before deletion.
  const mapped = await prisma.channelRatePlanMapping.count({ where: { ratePlanId: id, externalRateId: { not: null } } });
  if (mapped > 0) {
    redirect(`/rooms-rates?blocked=${encodeURIComponent(rp.name)}&kind=rate`);
  }

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

// --- Rate Plan Linkage (editable, spec §4.2) -------------------------------
// Derived prices are computed live from the parent (never materialized), so changing a parent/offset
// "recalculates" every child automatically on the next read. The guardrails we DO enforce here:
// no self-reference, no cycles, a chain that ultimately resolves to a MANUAL base rate, and a max depth.

const MAX_LINKAGE_DEPTH = 4;

export interface LinkagePayload {
  ratePlanId: string;
  mode: "derive" | "unlink";
  parentRatePlanId?: string | null;
  derivedDirection?: string;
  derivedType?: string;
  derivedValue?: number;
  derivedRounding?: string;
}

export async function saveRatePlanLinkage(payload: LinkagePayload): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const plan = await prisma.ratePlan.findFirst({ where: { id: payload.ratePlanId, propertyId } });
  if (!plan) return { ok: false, error: "Rate plan not found." };

  // Unlink → back to a manual, hand-entered rate.
  if (payload.mode === "unlink") {
    await prisma.ratePlan.update({
      where: { id: plan.id },
      data: { priceLogic: "manual", parentRatePlanId: null, derivedType: null, derivedDirection: null, derivedValue: null, derivedRounding: null },
    });
    await logAudit(propertyId, tenantId, { entity: `Rate Plan · ${plan.name}`, field: "linkage", newValue: "unlinked → manual" });
    await recordPush(propertyId, tenantId, `Rate plan "${plan.name}" is now a manual rate`);
    revalidatePath("/rooms-rates");
    revalidatePath("/calendar");
    return { ok: true };
  }

  const parentId = payload.parentRatePlanId;
  if (!parentId) return { ok: false, error: "Choose a parent rate plan." };
  if (parentId === plan.id) return { ok: false, error: "A rate plan can’t derive from itself." };

  const all = await prisma.ratePlan.findMany({ where: { propertyId }, select: { id: true, name: true, priceLogic: true, parentRatePlanId: true } });
  const byId = new Map(all.map((p) => [p.id, p]));
  const parent = byId.get(parentId);
  if (!parent) return { ok: false, error: "Parent rate plan not found." };

  // Walk UP from the proposed parent: reject a loop back to this plan, cap the depth, and require the
  // chain to terminate at a MANUAL root.
  let cursor: (typeof all)[number] | undefined = parent;
  let depth = 1;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor.id === plan.id) return { ok: false, error: "That would create a loop — a rate can’t derive from one of its own descendants." };
    if (seen.has(cursor.id)) break;
    seen.add(cursor.id);
    if (cursor.priceLogic === "manual" || !cursor.parentRatePlanId) break; // reached a manual root
    depth++;
    if (depth > MAX_LINKAGE_DEPTH) return { ok: false, error: `Derivation chains are limited to ${MAX_LINKAGE_DEPTH} levels — link to a plan closer to the base rate.` };
    cursor = byId.get(cursor.parentRatePlanId) ?? undefined;
  }
  if (!cursor || cursor.priceLogic !== "manual") return { ok: false, error: "A derived rate must ultimately trace back to a manual base rate." };

  await prisma.ratePlan.update({
    where: { id: plan.id },
    data: {
      priceLogic: "derived",
      parentRatePlanId: parentId,
      derivedType: payload.derivedType === "fixed" ? "fixed" : "percent",
      derivedDirection: payload.derivedDirection === "increase" ? "increase" : "decrease",
      derivedValue: Math.max(0, Math.trunc(payload.derivedValue ?? 0)),
      derivedRounding: payload.derivedRounding || "none",
    },
  });
  await logAudit(propertyId, tenantId, { entity: `Rate Plan · ${plan.name}`, field: "linkage", newValue: `derives from ${parent.name}` });
  await recordPush(propertyId, tenantId, `Rate plan "${plan.name}" now derives from "${parent.name}" — children recalculated`);
  revalidatePath("/rooms-rates");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}
