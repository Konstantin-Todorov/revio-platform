import "server-only";
import { planUnits, type UnitPlan } from "@revio/core";
import { fill } from "@revio/ui/i18n";
import { roomRulesStrings } from "@revio/ui/room-rules-strings";
import { prisma } from "./db";
import { i18n } from "./i18n/server";

/**
 * Who owns a room type's count, for a hotel with these products.
 *
 * RevioPMS edits room types only when nothing else sells them. Once RevioLink or RevioCRS is on the
 * account, the count is what every channel sells, and changing it belongs where the ARI push lives.
 */
export function roomTypesOwner(e: { channelManager: boolean; reservation: boolean }): "RevioCRS" | "RevioLink" | null {
  if (e.reservation) return "RevioCRS";
  if (e.channelManager) return "RevioLink";
  return null;
}

/**
 * Plan a run of new room numbers under one room type, and word the refusal if there is one.
 * The rule is core's `planUnits`; this only reads the rows it needs and says the answer.
 */
export async function planUnitsFor(args: {
  propertyId: string;
  roomType: { id: string; name: string; totalRooms: number };
  wanted: string[];
  entitlements: { channelManager: boolean; reservation: boolean };
}): Promise<{ plan: UnitPlan; refusal: string | null; skippedNote: string | null }> {
  const [taken, unitsOfType] = await Promise.all([
    prisma.unit.findMany({ where: { propertyId: args.propertyId }, select: { label: true } }),
    prisma.unit.count({ where: { roomTypeId: args.roomType.id } }),
  ]);
  const plan = planUnits({
    wanted: args.wanted,
    taken: taken.map((u) => u.label),
    totalRooms: args.roomType.totalRooms,
    unitsOfType,
  });
  const r = (await i18n()).t(roomRulesStrings);
  const owner = roomTypesOwner(args.entitlements);
  const where = owner ? fill(r.whereProduct, { product: owner }) : r.whereHere;
  const vars = { type: args.roomType.name, total: args.roomType.totalRooms, existing: unitsOfType, where };

  let refusal: string | null = null;
  if (!plan.ok && plan.reason === "all_exist") {
    refusal = args.wanted.length === 1 ? fill(r.labelTaken, { label: args.wanted[0]!.trim() }) : r.allExist;
  } else if (!plan.ok) {
    refusal = plan.left > 0 ? fill(r.overCapacity, { ...vars, left: plan.left }) : fill(r.overCapacityFull, vars);
  }
  const skippedNote = plan.ok && plan.skipped.length > 0 ? fill(r.skipped, { list: plan.skipped.join(", ") }) : null;
  return { plan, refusal, skippedNote };
}
