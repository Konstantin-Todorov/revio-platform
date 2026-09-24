"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { recordOpsEvent } from "./events";
import { DELEGATOR_ROLES } from "./roles";
import { str } from "./mutation-helpers";
import { flashError, setFlash } from "@revio/ui/flash";
import { i18n } from "./i18n/server";
import { flash } from "./i18n/flash";

/** What this file's refusals say, in the reader's language — see `i18n/flash.ts`. */
async function flashSay() {
  return (await i18n()).t(flash);
}

/**
 * Clock-in mechanics (PMS-REFINEMENT-R1 §6.7 / §10.3) on the ONE shared identity. Staff self-clock from
 * their own view; FD/supervisors/managers may clock their department in (delegated, logged). Every
 * clock event also appends to the ops event stream so the KPI + live availability share one source.
 *
 * Boundary: availability + light KPI, NOT payroll/attendance/HR.
 */

// Roles allowed to clock OTHER staff in/out (delegated). Managers always; supervisors + reception for
// their operational departments. (Fine-grained per-role delegation via the §9.8 matrix is a later refinement.)

/** The hotel's own clock. Falls back to UTC rather than throwing — a missing zone must not stop a
 *  housekeeper clocking in. */
async function propertyTimeZone(propertyId: string): Promise<string> {
  const p = await prisma.property.findUnique({ where: { id: propertyId }, select: { timezone: true } });
  return p?.timezone ?? "UTC";
}

/**
 * "since 08:15", in the PROPERTY's clock.
 *
 * A time shown to somebody standing in the building is their wall clock, not the server's. Sofia is
 * three hours ahead of UTC, so a shift opened at 08:15 would otherwise read "since 05:15" to the
 * person who opened it.
 */
function sinceLabel(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
}

function refresh() {
  revalidatePath("/staff");
  revalidatePath("/housekeeping");
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

/** Open a shift for the current user (self clock-in). No-op if already clocked in. */
export async function clockInSelf(): Promise<void> {
  const s = await getSession();
  // No session: middleware has already sent them to /login. There is nobody on the other end.
  if (!s) return;
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId: s.userId, clockOutAt: null } });
  if (open) {
    // Not an error and not nothing. A second device, a stale tab, or a colleague clocking them in
    // all land here, and a button that does nothing tells them the app is broken.
    const tz = await propertyTimeZone(s.activePropertyId);
    return setFlash("info", `You are already clocked in — since ${sinceLabel(open.clockInAt, tz)}.`);
  }
  const shift = await prisma.staffShift.create({
    data: { tenantId: s.tenantId, propertyId: s.activePropertyId, userId: s.userId, role: s.role },
  });
  await recordOpsEvent({
    propertyId: s.activePropertyId, tenantId: s.tenantId, domain: "workforce",
    action: "clock_in", userId: s.userId, actorId: s.userId, refId: shift.id,
  });
  refresh();
}

/** Close the current user's open shift (self clock-out). */
export async function clockOutSelf(): Promise<void> {
  const s = await getSession();
  if (!s) return; // see clockInSelf
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId: s.userId, clockOutAt: null } });
  if (!open) return setFlash("info", "You are not clocked in, so there is no shift to end.");
  await prisma.staffShift.update({ where: { id: open.id }, data: { clockOutAt: new Date() } });
  await recordOpsEvent({
    propertyId: s.activePropertyId, tenantId: s.tenantId, domain: "workforce",
    action: "clock_out", userId: s.userId, actorId: s.userId, refId: open.id,
  });
  refresh();
}

/** Delegated clock-in: a manager/supervisor/reception clocks another user in. Logged (clockedInById). */
export async function clockInUser(fd: FormData): Promise<void> {
  const s = await getSession();
  if (!s || !DELEGATOR_ROLES.has(s.role)) return flashError((await flashSay()).workforce.delegatorsOnly);
  const userId = str(fd, "userId");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  // Another hotel's user id is a crafted POST — there is no honest message for it, and naming the
  // row would confirm it exists.
  if (!target || target.tenantId !== s.tenantId) return;
  // Deactivated is a REAL case somebody hits: a leaver still listed on a stale roster page.
  if (!target.active) {
    const say = (await flashSay()).workforce;
    return flashError(say.inactive(target.name || say.thatPerson));
  }
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId, clockOutAt: null } });
  if (open) {
    const tz = await propertyTimeZone(s.activePropertyId);
    return setFlash("info", `${target.name || "They"} are already clocked in — since ${sinceLabel(open.clockInAt, tz)}.`);
  }
  const shift = await prisma.staffShift.create({
    data: { tenantId: s.tenantId, propertyId: s.activePropertyId, userId, role: target.role, clockedInById: s.userId },
  });
  await recordOpsEvent({
    propertyId: s.activePropertyId, tenantId: s.tenantId, domain: "workforce",
    action: "clock_in", userId, actorId: s.userId, refId: shift.id, meta: { delegated: true },
  });
  refresh();
}

/** Delegated clock-out. */
export async function clockOutUser(fd: FormData): Promise<void> {
  const s = await getSession();
  if (!s || !DELEGATOR_ROLES.has(s.role)) return flashError((await flashSay()).workforce.delegatorsOnly);
  const userId = str(fd, "userId");
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId, clockOutAt: null } });
  if (!open) return setFlash("info", "They are not clocked in, so there is no shift to end.");
  await prisma.staffShift.update({ where: { id: open.id }, data: { clockOutAt: new Date() } });
  await recordOpsEvent({
    propertyId: s.activePropertyId, tenantId: s.tenantId, domain: "workforce",
    action: "clock_out", userId, actorId: s.userId, refId: open.id, meta: { delegated: true },
  });
  refresh();
}
