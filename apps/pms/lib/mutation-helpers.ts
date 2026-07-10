import "server-only";
import { syncRealChannels } from "@revio/connectivity";
import { prisma } from "./db";

/** Record an Audit Log entry. Every hand-made operational change is permanent and attributable. */
export async function logAudit(
  propertyId: string,
  tenantId: string,
  entry: { entity: string; field?: string; oldValue?: string; newValue?: string; source?: string; userId?: string },
) {
  await prisma.auditEntry.create({
    data: {
      tenantId, propertyId,
      userId: entry.userId ?? null,
      entity: entry.entity,
      field: entry.field ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      source: entry.source ?? "manual",
      channelCode: "all",
      syncResult: "success",
    },
  });
}

/**
 * Record a sync event so the shared Sync Center reflects a PMS-originated inventory change (e.g. a
 * Unit going out-of-order writes a RoomInventoryPeriod → the waterfall drops a room → the CM sends it
 * on its next push). This is the visible trace of the one cross-product write.
 */
export async function recordSync(propertyId: string, tenantId: string, summary: string, detail?: string) {
  // BOUNDARY RULE (spec CM-GUIDE-V2 §1): callers pass the AVAILABILITY EFFECT only — never the
  // operational cause (no unit labels, guest names, maintenance notes). Channel attribution
  // (spec §5.1): one event per connected mock channel; real channels report their own pushes.
  const mocks = await prisma.channel.findMany({
    where: { propertyId, status: "connected", connectivityMode: "mock" },
    select: { id: true, name: true },
  });
  if (mocks.length === 0) {
    await prisma.syncEvent.create({
      data: { tenantId, propertyId, kind: "push", status: "success", summary, detail: detail ?? null },
    });
  } else {
    await prisma.syncEvent.createMany({
      data: mocks.map((c) => ({ tenantId, propertyId, channelId: c.id, kind: "push", status: "success", summary, detail: detail ?? null })),
    });
  }
  // Immediate cross-product propagation: a PMS inventory change (unit OOO, walk-in) pushes the new
  // availability to any real (channex) channel now. No-op when every channel is mock; never break the write.
  try {
    await syncRealChannels(prisma, propertyId);
  } catch {
    /* per-channel failures are already isolated inside syncRealChannels. */
  }
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export { utcDay } from "./format";
