"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { logAudit, recordPush, str, int, strList, utcDay } from "./mutation-helpers";

export type ActionResult = { ok: boolean; error?: string };

const BOOL_TYPES = new Set(["stop_sell", "cta", "ctd"]);

function revalidateRates() {
  revalidatePath("/rates");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reservations/new");
}

// --- Rate plans (same shared tables the CM manages — one write path per app, same engines) ----

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
    const roomTypes = await prisma.roomType.findMany({ where: { propertyId } });
    await prisma.ratePlanRoomType.createMany({ data: roomTypes.map((rt) => ({ ratePlanId: rp.id, roomTypeId: rt.id })) });
    await logAudit(propertyId, tenantId, { entity: `Rate Plan · ${name}`, field: "create", newValue: name });
    await recordPush(propertyId, tenantId, `Rate plan "${name}" created`);
  }
  revalidateRates();
  return { ok: true };
}

export async function deleteRatePlan(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  if (!id) return;
  const rp = await prisma.ratePlan.findUnique({ where: { id }, include: { _count: { select: { children: true, resLines: true } } } });
  if (!rp) return;

  if (rp._count.children > 0 || rp._count.resLines > 0) {
    await prisma.ratePlan.update({ where: { id }, data: { active: false } });
    await logAudit(property.id, property.tenantId, { entity: `Rate Plan · ${rp.name}`, field: "deactivate", newValue: "inactive (in use)" });
  } else {
    await prisma.ratePlan.delete({ where: { id } });
    await logAudit(property.id, property.tenantId, { entity: `Rate Plan · ${rp.name}`, field: "delete", oldValue: rp.name });
    await recordPush(property.id, property.tenantId, `Rate plan "${rp.name}" removed`);
  }
  revalidateRates();
}

// --- Restriction rules (level 2) — with CRS booking-source scope --------------

export async function saveRestrictionRule(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { id: propertyId, tenantId } = await getProperty();
  const rowId = str(fd, "id");
  const name = str(fd, "name");
  const type = str(fd, "type");
  if (!name) return { ok: false, error: "Name is required." };
  if (!type) return { ok: false, error: "Pick a restriction type." };
  const dateFrom = str(fd, "dateFrom");
  const dateTo = str(fd, "dateTo");
  if (!dateFrom || !dateTo) return { ok: false, error: "Pick a date range." };

  const isBool = BOOL_TYPES.has(type);
  const data = {
    tenantId, propertyId, name, type,
    roomTypeId: str(fd, "roomTypeId") || null,
    channelCodes: strList(fd, "channelCodes"),
    // Empty = every booking source; otherwise only reservations from these categories are blocked.
    sourceCategories: strList(fd, "sourceCategories"),
    dateFrom: utcDay(dateFrom), dateTo: utcDay(dateTo),
    valueInt: isBool ? null : Math.max(0, int(fd, "value")),
    valueBool: isBool ? true : null,
    priority: int(fd, "priority", 0),
    active: fd.get("active") != null,
  };

  if (rowId) {
    await prisma.restrictionRule.update({ where: { id: rowId }, data });
    await logAudit(propertyId, tenantId, { entity: `Restriction · ${name}`, field: "edit", newValue: type, source: "rule" });
  } else {
    await prisma.restrictionRule.create({ data });
    await logAudit(propertyId, tenantId, { entity: `Restriction · ${name}`, field: "create", newValue: type, source: "rule" });
  }
  await recordPush(propertyId, tenantId, `Restriction rule "${name}" applied`);
  revalidateRates();
  return { ok: true };
}

export async function deleteRestrictionRule(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  const rule = await prisma.restrictionRule.findUnique({ where: { id } });
  if (!rule) return;
  await prisma.restrictionRule.delete({ where: { id } });
  await logAudit(propertyId, tenantId, { entity: `Restriction · ${rule.name}`, field: "delete", source: "rule" });
  await recordPush(propertyId, tenantId, `Restriction rule "${rule.name}" removed`);
  revalidateRates();
}

// --- Property defaults (level 4 — the global fallback) -------------------------

export async function savePropertyDefaults(fd: FormData): Promise<void> {
  const { id: propertyId, tenantId } = await getProperty();
  const optInt = (key: string): number | null => {
    const v = str(fd, key);
    if (v === "") return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const data = {
    defStopSell: fd.get("defStopSell") != null,
    defMinLos: optInt("defMinLos"),
    defMaxLos: optInt("defMaxLos"),
    defCta: fd.get("defCta") != null,
    defCtd: fd.get("defCtd") != null,
    defAdvancePurchaseMin: optInt("defAdvancePurchaseMin"),
    defAdvancePurchaseMax: optInt("defAdvancePurchaseMax"),
    holdTtlMinutes: Math.min(Math.max(int(fd, "holdTtlMinutes", 30), 5), 240),
  };
  await prisma.propertyDefaults.upsert({
    where: { propertyId },
    create: { tenantId, propertyId, ...data },
    update: data,
  });
  await logAudit(propertyId, tenantId, {
    entity: "Property defaults",
    field: "restriction fallback",
    newValue: `min ${data.defMinLos ?? "—"} / max ${data.defMaxLos ?? "—"} · hold TTL ${data.holdTtlMinutes}m`,
  });
  await recordPush(propertyId, tenantId, "Property default restrictions updated");
  revalidateRates();
}

// --- Calendar rate edit (standard plan) ---------------------------------------

export async function saveCalendarRate(args: { roomTypeId: string; date: string; value: string }): Promise<void> {
  const property = await getProperty();
  const { id: propertyId, tenantId } = property;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return;

  const roomType = await prisma.roomType.findFirst({ where: { id: args.roomTypeId, propertyId } });
  const standard = await prisma.ratePlan.findFirst({ where: { propertyId, priceLogic: "manual", active: true }, orderBy: { sortOrder: "asc" } });
  if (!roomType || !standard) return;

  const priceMinor = Math.round(Number(args.value) * 100);
  if (!Number.isFinite(priceMinor) || priceMinor < 0) return;
  const date = utcDay(args.date);

  const before = await prisma.ratePrice.findUnique({ where: { roomTypeId_ratePlanId_date: { roomTypeId: roomType.id, ratePlanId: standard.id, date } } });
  await prisma.ratePrice.upsert({
    where: { roomTypeId_ratePlanId_date: { roomTypeId: roomType.id, ratePlanId: standard.id, date } },
    create: { tenantId, propertyId, roomTypeId: roomType.id, ratePlanId: standard.id, date, priceMinor },
    update: { priceMinor },
  });
  await logAudit(propertyId, tenantId, {
    entity: `RatePrice · ${roomType.name} / ${standard.name}`,
    field: args.date,
    oldValue: before ? `€${(before.priceMinor / 100).toFixed(0)}` : undefined,
    newValue: `€${(priceMinor / 100).toFixed(0)}`,
  });
  await recordPush(propertyId, tenantId, `Rate updated for ${roomType.name} (${args.date})`);
  revalidatePath("/inventory");
}
