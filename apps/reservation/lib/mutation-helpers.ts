import "server-only";
import { decimalOr, intOr, minorUnitsOr } from "@revio/core";
import { pushVerdict, syncRealChannels, type PushScope, type RealPushOutcome } from "@revio/connectivity";
import { prisma } from "./db";
import { getSession } from "./session";

/**
 * The signed-in user, or null when there is no request context (cron, scripts, webhooks).
 *
 * `cookies()` throws outside a request rather than returning empty, so this cannot be a plain call.
 */
async function currentActorId(): Promise<string | null> {
  try {
    return (await getSession())?.userId ?? null;
  } catch {
    return null;
  }
}


/**
 * Record an Audit Log entry. Every hand-made change is permanent and attributable.
 *
 * "Attributable" was an aspiration until 2026-09-01: this helper did not accept a user at all, so
 * every entry this app has ever written names no actor. 93 of 139 `logAudit` calls across the
 * platform recorded nothing about who acted, which makes an audit trail unable to answer the one
 * question it exists for.
 *
 * The actor is resolved HERE, from the session, rather than passed by 93 call sites. A caller may
 * still name one explicitly — a delegated action attributes to the person who performed it, not to
 * whoever happens to be signed in — and an explicit value always wins.
 *
 * Falls back to null rather than throwing when there is no request to read a session from: the
 * cron jobs and the night audit write audit entries too, and an unattributed entry is worth far
 * more than a crashed close-day.
 */
export async function logAudit(
  propertyId: string,
  tenantId: string,
  entry: { entity: string; field?: string; oldValue?: string; newValue?: string; source?: string; userId?: string },
) {
  await prisma.auditEntry.create({
    data: {
      tenantId, propertyId,
      userId: entry.userId ?? (await currentActorId()),
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
 * Record a push so the Sync Center shows activity, then AUTO-PUSH the change through every channel
 * that runs a real adapter (connectivityMode != mock). Mock channels keep the simulated event only;
 * channex-mode channels get an actual ARI push — no manual Re-sync needed after an edit.
 */
export async function recordPush(propertyId: string, tenantId: string, summary: string, scope?: PushScope) {
  // Channel attribution (spec §5.1): one event per connected mock channel; real channels report
  // their own attributed pushes from syncRealChannels below.
  const mocks = await prisma.channel.findMany({
    where: { propertyId, status: "connected", connectivityMode: "mock" },
    select: { id: true, name: true },
  });
  if (mocks.length > 0) {
    await prisma.syncEvent.createMany({
      data: mocks.map((c) => ({ tenantId, propertyId, channelId: c.id, kind: "push", status: "success", summary, detail: `Pushed to ${c.name} via the connected CM (mock)` })),
    });
  }

  /*
   * ⚠️ THE EVENT IS WRITTEN AFTER THE PUSH, AND SAYS WHAT THE PUSH DID.
   *
   * This block used to write `status: "success"` with NO channel, **before** `syncRealChannels` ran
   * and regardless of what it did. That is the row a tester found on 2026-09-12 with `CHANNEL = —`
   * and status success, on a property where no price had ever reached a channel, under a Sync Center
   * reading "everything is syncing cleanly" (BUG-014).
   *
   * It was the worst kind of false green: it masked thirteen other defects, because no fix to any of
   * them could be told apart from the failure. `success` now means a channel accepted something.
   */
  let real: RealPushOutcome;
  try {
    real = await syncRealChannels(prisma, propertyId, scope);
  } catch {
    // Never break the caller's write on a push failure — but never call it a success either.
    real = { attempted: 0, delivered: 0, failed: 1, paused: false, unmapped: [] };
  }

  /*
   * One shared decision — `pushVerdict` in `@revio/connectivity` — so the two products cannot come
   * to different conclusions about what "syncing cleanly" means.
   */
  const verdict = pushVerdict(real);
  if (verdict.delivered) return;
  // Demo property: the mock rows above are the whole truth.
  if (mocks.length > 0) return;

  await prisma.syncEvent.create({
    data: { tenantId, propertyId, kind: "push", status: verdict.status, summary, detail: verdict.detail },
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
/**
 * An integer from a form field, or the fallback (Y1).
 *
 * ⚠️ This used to be `Number.isFinite(Number(fd.get(key))) ? … : fallback`, which looked careful and
 * was not: **`Number("")` is 0 and `Number(null)` is 0**. A user typing letters into an
 * `<input type="number">` makes the browser submit `""` — so "rooms to sell" silently became 0 and
 * closed the property out on every channel, VAT silently became 0%, and the `fallback` that 21 call
 * sites were passing could only ever fire for a non-numeric string a number input cannot produce.
 *
 * `intOr` in `@revio/core` returns the fallback for absent, blank AND unparseable, which is what
 * every call site already assumed. A real `0` is still a real `0`.
 */
export function int(fd: FormData, key: string, fallback = 0): number {
  return intOr(fd.get(key), fallback);
}

/** A decimal (rates, percentages). Same non-value handling as `int`. */
export function decimal(fd: FormData, key: string, fallback = 0): number {
  return decimalOr(fd.get(key), fallback);
}

/** Money: a major-unit field ("129.50") to integer minor units, converted from the string. */
export function money(fd: FormData, key: string, fallback = 0): number {
  return minorUnitsOr(fd.get(key), fallback);
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
