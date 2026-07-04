import "server-only";
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
  await prisma.syncEvent.create({
    data: { tenantId, propertyId, kind: "push", status: "success", summary, detail: detail ?? null },
  });
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function utcDay(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}
