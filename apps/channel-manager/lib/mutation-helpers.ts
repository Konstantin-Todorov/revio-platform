import "server-only";
import { prisma } from "@revio/db";

/** Record an Audit Log entry. Every hand-made change is permanent and attributable. */
export async function logAudit(
  propertyId: string,
  tenantId: string,
  entry: { entity: string; field?: string; oldValue?: string; newValue?: string; source?: string },
) {
  await prisma.auditEntry.create({
    data: {
      tenantId, propertyId,
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

/** Record a push to connected channels (mock connectivity) so the Sync Center shows activity. */
export async function recordPush(propertyId: string, tenantId: string, summary: string) {
  const channels = await prisma.channel.count({ where: { propertyId, status: "connected" } });
  await prisma.syncEvent.create({
    data: { tenantId, propertyId, kind: "push", status: "success", summary, detail: `Pushed to ${channels} channels` },
  });
}

/** Record a pull (a booking arriving from a channel). */
export async function recordPull(propertyId: string, tenantId: string, summary: string, channelId?: string) {
  await prisma.syncEvent.create({
    data: { tenantId, propertyId, channelId: channelId ?? null, kind: "pull", status: "success", summary },
  });
}

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
export function strList(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v)).filter(Boolean);
}

const DAY = 86_400_000;
export function eachDate(fromIso: string, toIso: string, daysOfWeek?: number[]): Date[] {
  const out: Date[] = [];
  const from = new Date(fromIso + "T00:00:00Z");
  const to = new Date(toIso + "T00:00:00Z");
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const d = new Date(t);
    if (!daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.includes(d.getUTCDay())) out.push(d);
  }
  return out;
}
export function utcDay(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}
