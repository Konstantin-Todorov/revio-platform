"use server";

import { revalidatePath } from "next/cache";
import {
  planPricingModelSwitch, describeSwitch, validateOptions, describeProblem,
  effectiveModel, effectivePrimary, planCeiling, MAX_OCCUPANCY,
  type PlanToSwitch, type PricingModel, type SeedMode,
} from "@revio/core";
import { withTenantTransaction } from "@revio/db";
import { prisma } from "./db";
import { getProperty } from "./data";
import { guard, requireCapability } from "./authz";
import { logAudit, str } from "./mutation-helpers";

/**
 * Turning occupancy-based pricing on and off — CRS §6.2.
 *
 * ## Why the preview and the apply are the same function
 *
 * A property toggle touches every plan on every room type. Six room types and seven plans is 42
 * option sets. If the confirmation screen were computed by one piece of code and the write by
 * another, the hotelier would be approving a description of something else — and the day they
 * diverge is the day somebody's prices change in a way nobody predicted.
 *
 * `planPricingModelSwitch` decides; `previewPricingModel` shows what it decided; `applyPricingModel`
 * writes exactly that. One function, two callers.
 *
 * ## Why it is one transaction
 *
 * Half-applying leaves some plans per-person and some per-room with nothing recording which — a
 * state no screen is built to render and no push can resolve. All of it lands, or none of it does.
 */

export type ObpResult = { ok: true; message: string } | { ok: false; error: string };

/** Everything the switch needs, read once. */
async function loadPlans(propertyId: string): Promise<PlanToSwitch[]> {
  const plans = await prisma.ratePlan.findMany({
    where: { propertyId, active: true },
    include: {
      occupancyOptions: true,
      roomTypeLinks: { include: { roomType: { select: { id: true, maxGuests: true, defaultOccupancy: true } } } },
    },
    orderBy: { sortOrder: "asc" },
  });

  // A plan with no explicit room-type links applies to ALL of them — the "unscoped means everything"
  // convention used across the platform. Resolving it here rather than in the pure function keeps
  // that convention in one place.
  const allRooms = await prisma.roomType.findMany({
    where: { propertyId, active: true },
    select: { id: true, maxGuests: true, defaultOccupancy: true },
  });

  return plans.map((rp) => {
    const scoped = rp.roomTypeLinks.map((l) => l.roomType);
    const rooms = scoped.length > 0 ? scoped : allRooms;
    return {
      ratePlanId: rp.id,
      planName: rp.name,
      planModel: rp.pricingModel,
      primaryOccupancy: rp.primaryOccupancy,
      roomTypes: rooms.map((r) => ({
        roomTypeId: r.id, maxOccupancy: r.maxGuests, defaultOccupancy: r.defaultOccupancy,
      })),
      options: rp.occupancyOptions.map((o) => ({
        occupancy: o.occupancy,
        isPrimary: o.isPrimary,
        mode: o.mode === "derived" ? ("derived" as const) : ("manual" as const),
        rateMinor: o.rateMinor,
        adjustmentType: o.adjustmentType as "percent" | "fixed" | null,
        direction: o.direction as "increase" | "decrease" | null,
        value: o.value,
        rounding: o.rounding as never,
      })),
    };
  });
}

export interface PricingModelPreview {
  target: PricingModel;
  summary: string;
  rows: { planName: string; before: number; after: number; changed: boolean; note?: string }[];
  noop: boolean;
}

/** What would happen, without doing it. */
export async function previewPricingModel(target: PricingModel, seed: SeedMode): Promise<PricingModelPreview> {
  await requireCapability("manageRates");
  const property = await getProperty();
  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } });

  const plan = planPricingModelSwitch({
    target,
    propertyModel: (defaults?.pricingModel as PricingModel) ?? "per_room",
    plans: await loadPlans(property.id),
    seed,
  });

  return {
    target,
    summary: describeSwitch(plan, target),
    noop: plan.noop,
    rows: plan.results.map((r) => ({
      planName: r.planName,
      before: r.before,
      after: r.after,
      changed: r.changed,
      ...(r.skipped ? { note: r.skipped } : {}),
    })),
  };
}

/**
 * Apply it.
 *
 * Recomputed here rather than trusting a plan posted from the browser: the preview is a rendering,
 * not an instruction, and a form can be replayed after somebody else has changed a rate plan.
 */
export async function applyPricingModel(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const property = await getProperty();

  const target: PricingModel = str(fd, "target") === "per_person" ? "per_person" : "per_room";
  const seed: SeedMode = str(fd, "seed") === "derive" ? "derive" : "copy";

  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } });
  const switchPlan = planPricingModelSwitch({
    target,
    propertyModel: (defaults?.pricingModel as PricingModel) ?? "per_room",
    plans: await loadPlans(property.id),
    seed,
  });

  await withTenantTransaction(property.tenantId, async (tx) => {
    await tx.propertyDefaults.upsert({
      where: { propertyId: property.id },
      create: { tenantId: property.tenantId, propertyId: property.id, pricingModel: target, occupancySeedMode: seed },
      update: { pricingModel: target, occupancySeedMode: seed },
    });

    for (const r of switchPlan.results) {
      if (!r.changed) continue;
      // Replace rather than reconcile. The option set is small, the pure function has already
      // decided the whole shape, and a diff would be a second implementation of the same decision.
      await tx.ratePlanOccupancy.deleteMany({ where: { ratePlanId: r.ratePlanId } });
      await tx.ratePlanOccupancy.createMany({
        data: r.options.map((o) => ({
          tenantId: property.tenantId,
          ratePlanId: r.ratePlanId,
          occupancy: o.occupancy,
          isPrimary: o.isPrimary,
          mode: o.mode,
          rateMinor: o.rateMinor ?? null,
          adjustmentType: o.adjustmentType ?? null,
          direction: o.direction ?? null,
          value: o.value ?? null,
          rounding: (o.rounding as string) ?? "none",
        })),
      });
      await tx.ratePlan.update({
        where: { id: r.ratePlanId },
        data: { primaryOccupancy: r.primaryOccupancy },
      });
    }
  });

  await logAudit(property.id, property.tenantId, {
    entity: "Pricing model",
    field: target === "per_person" ? "occupancy-based" : "per room",
    oldValue: defaults?.pricingModel ?? "per_room",
    newValue: `${target} · ${switchPlan.changedCount} plan(s) updated`,
  });

  revalidatePath("/settings");
  revalidatePath("/rates");
  revalidatePath("/inventory");
}

/** The display preference and age bands — configuration, no rate data touched. */
export async function saveObpDisplay(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const property = await getProperty();

  const display = str(fd, "occupancyDisplay") === "all" ? "all" : "primary_expand";
  const infant = clampInt(str(fd, "ageInfantMax"), 0, 17, 2);
  // A child band below the infant band would make the two overlap and every fee ambiguous.
  const child = clampInt(str(fd, "ageChildMax"), infant + 1, 17, Math.max(infant + 1, 11));

  await prisma.propertyDefaults.upsert({
    where: { propertyId: property.id },
    create: {
      tenantId: property.tenantId, propertyId: property.id,
      occupancyDisplay: display, ageInfantMax: infant, ageChildMax: child,
    },
    update: { occupancyDisplay: display, ageInfantMax: infant, ageChildMax: child },
  });

  revalidatePath("/settings");
}

/**
 * A single plan's override — Channex sets `sell_mode` per rate plan, so a hotel can legitimately run
 * some plans per-room and some per-person.
 *
 * Refuses to leave the plan in a shape that cannot be pushed. An invalid option set does not fail at
 * Channex; it is accepted and sells the wrong price.
 */
export async function saveRatePlanOccupancy(fd: FormData): Promise<ObpResult> {
  // `guard`, not `requireCapability`: this action returns a result, so the form the user is looking
  // at can say why it was refused instead of being redirected away from their own work.
  const g = await guard("manageRates");
  if (!g.ok) return { ok: false, error: g.error };

  const property = await getProperty();
  const ratePlanId = str(fd, "ratePlanId");
  const raw = str(fd, "pricingModel");
  const model: string | null = raw === "inherit" || raw === "" ? null : raw === "per_person" ? "per_person" : "per_room";

  const plan = await prisma.ratePlan.findFirst({
    where: { id: ratePlanId, propertyId: property.id },
    include: {
      occupancyOptions: true,
      roomTypeLinks: { include: { roomType: { select: { id: true, maxGuests: true, defaultOccupancy: true } } } },
    },
  });
  if (!plan) return { ok: false, error: "That rate plan no longer exists." };

  const defaults = await prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } });
  const propertyModel = defaults?.pricingModel ?? "per_room";
  const rooms = plan.roomTypeLinks.map((l) => l.roomType);
  const ceiling = planCeiling(rooms.map((r) => ({ maxOccupancy: r.maxGuests })));
  const resolved = effectiveModel(model, propertyModel);

  const primaryRaw = Number(str(fd, "primaryOccupancy"));
  const primary = effectivePrimary(
    Number.isFinite(primaryRaw) && primaryRaw > 0 ? primaryRaw : null,
    rooms[0]?.defaultOccupancy ?? null,
    ceiling,
  );

  const switched = planPricingModelSwitch({
    target: resolved,
    propertyModel: resolved, // this plan's own choice governs — it is not being inherited here
    plans: [{
      ratePlanId: plan.id, planName: plan.name, planModel: null, primaryOccupancy: primary,
      roomTypes: rooms.map((r) => ({ roomTypeId: r.id, maxOccupancy: r.maxGuests, defaultOccupancy: r.defaultOccupancy })),
      options: plan.occupancyOptions.map((o) => ({
        occupancy: o.occupancy, isPrimary: o.isPrimary,
        mode: o.mode === "derived" ? ("derived" as const) : ("manual" as const),
        rateMinor: o.rateMinor,
        adjustmentType: o.adjustmentType as "percent" | "fixed" | null,
        direction: o.direction as "increase" | "decrease" | null,
        value: o.value, rounding: o.rounding as never,
      })),
    }],
    seed: (defaults?.occupancySeedMode as SeedMode) ?? "copy",
  });

  const next = switched.results[0]!;
  const problems = validateOptions(next.options, resolved, ceiling);
  if (problems.length > 0) return { ok: false, error: describeProblem(problems[0]!) };

  await withTenantTransaction(property.tenantId, async (tx) => {
    await tx.ratePlan.update({
      where: { id: plan.id },
      data: { pricingModel: model, primaryOccupancy: primary },
    });
    if (next.changed) {
      await tx.ratePlanOccupancy.deleteMany({ where: { ratePlanId: plan.id } });
      await tx.ratePlanOccupancy.createMany({
        data: next.options.map((o) => ({
          tenantId: property.tenantId, ratePlanId: plan.id,
          occupancy: o.occupancy, isPrimary: o.isPrimary, mode: o.mode,
          rateMinor: o.rateMinor ?? null,
          adjustmentType: o.adjustmentType ?? null,
          direction: o.direction ?? null,
          value: o.value ?? null,
          rounding: (o.rounding as string) ?? "none",
        })),
      });
    }
  });

  revalidatePath("/rates");
  return {
    ok: true,
    message: `${plan.name} now prices ${resolved === "per_person" ? "per person" : "per room"}.`,
  };
}

/** Which occupancy is primary for a room type — the suggested primary for its plans. */
export async function saveRoomDefaultOccupancy(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const property = await getProperty();
  const roomTypeId = str(fd, "roomTypeId");

  const room = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId: property.id } });
  if (!room) return;

  const raw = Number(str(fd, "defaultOccupancy"));
  // Above the ceiling is not a default, it is an unreachable one. Clamped rather than refused —
  // this is a suggestion for plans, not a rate.
  const value = Number.isFinite(raw) && raw > 0
    ? Math.min(Math.max(1, Math.round(raw)), Math.min(room.maxGuests, MAX_OCCUPANCY))
    : null;

  await prisma.roomType.update({ where: { id: roomTypeId }, data: { defaultOccupancy: value } });
  revalidatePath("/rooms-rates");
  revalidatePath("/settings");
}

function clampInt(v: string, lo: number, hi: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(lo, Math.round(n)), hi);
}
