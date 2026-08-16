"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { recordOpsEvent } from "./events";
import { MANAGER_ROLES } from "./roles";
import { str } from "./mutation-helpers";

/**
 * Clock-in mechanics (PMS-REFINEMENT-R1 §6.7 / §10.3) on the ONE shared identity. Staff self-clock from
 * their own view; FD/supervisors/managers may clock their department in (delegated, logged). Every
 * clock event also appends to the ops event stream so the KPI + live availability share one source.
 *
 * Boundary: availability + light KPI, NOT payroll/attendance/HR.
 */

// Roles allowed to clock OTHER staff in/out (delegated). Managers always; supervisors + reception for
// their operational departments. (Fine-grained per-role delegation via the §9.8 matrix is a later refinement.)
const DELEGATOR_ROLES = new Set([...MANAGER_ROLES, "hk_supervisor", "reception"]);

function refresh() {
  revalidatePath("/staff");
  revalidatePath("/housekeeping");
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

/** Open a shift for the current user (self clock-in). No-op if already clocked in. */
export async function clockInSelf(): Promise<void> {
  const s = await getSession();
  if (!s) return;
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId: s.userId, clockOutAt: null } });
  if (open) return;
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
  if (!s) return;
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId: s.userId, clockOutAt: null } });
  if (!open) return;
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
  if (!s || !DELEGATOR_ROLES.has(s.role)) return;
  const userId = str(fd, "userId");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.tenantId !== s.tenantId || !target.active) return;
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId, clockOutAt: null } });
  if (open) return;
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
  if (!s || !DELEGATOR_ROLES.has(s.role)) return;
  const userId = str(fd, "userId");
  const open = await prisma.staffShift.findFirst({ where: { propertyId: s.activePropertyId, userId, clockOutAt: null } });
  if (!open) return;
  await prisma.staffShift.update({ where: { id: open.id }, data: { clockOutAt: new Date() } });
  await recordOpsEvent({
    propertyId: s.activePropertyId, tenantId: s.tenantId, domain: "workforce",
    action: "clock_out", userId, actorId: s.userId, refId: open.id, meta: { delegated: true },
  });
  refresh();
}
