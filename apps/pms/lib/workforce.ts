import "server-only";
import { prisma } from "./db";
import { activeProperty } from "./data";
import { ROLE_LABEL } from "./roles";

/**
 * Workforce availability (PMS-REFINEMENT-R1 §6.7 / §10.2) — who is clocked in right now. "Active" = a
 * StaffShift with clockOutAt = null. Feeds the Staff & Access workforce dashboard, the housekeeping /
 * maintenance assignment feasibility signal, and the clock-in KPI.
 *
 * Boundary: availability + light KPI, NOT payroll/attendance/HR (§6.9, §10.6).
 */

export type ActiveShift = {
  id: string;
  userId: string;
  userName: string;
  role: string;
  roleLabel: string;
  clockInAt: Date;
  delegated: boolean; // clocked in by a supervisor/FD rather than self
};

/** Every currently-active shift (clocked in, not yet out) with the staff member's name. */
export async function getActiveShifts(): Promise<ActiveShift[]> {
  const { session, property } = await activeProperty();
  const shifts = await prisma.staffShift.findMany({
    where: { propertyId: property.id, clockOutAt: null },
    orderBy: { clockInAt: "asc" },
  });
  if (shifts.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { tenantId: session.tenantId, id: { in: shifts.map((s) => s.userId) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return shifts.map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: nameOf.get(s.userId) ?? "—",
    role: s.role,
    roleLabel: ROLE_LABEL[s.role] ?? s.role,
    clockInAt: s.clockInAt,
    delegated: s.clockedInById != null,
  }));
}

export type WorkforceGroup = { role: string; roleLabel: string; active: ActiveShift[] };

/** Active workforce grouped by role/department for the §10.2 dashboard. */
export async function getWorkforceSummary(): Promise<{ groups: WorkforceGroup[]; totalActive: number }> {
  const active = await getActiveShifts();
  const byRole = new Map<string, ActiveShift[]>();
  for (const s of active) {
    const list = byRole.get(s.role) ?? [];
    list.push(s);
    byRole.set(s.role, list);
  }
  const groups = [...byRole.entries()].map(([role, list]) => ({
    role, roleLabel: ROLE_LABEL[role] ?? role, active: list,
  }));
  return { groups, totalActive: active.length };
}

/** Is this user currently clocked in? (their open shift, if any). */
export async function getOpenShift(userId: string) {
  const { property } = await activeProperty();
  return prisma.staffShift.findFirst({
    where: { propertyId: property.id, userId, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
}

/** Count of active cleaners — the feasibility denominator for housekeeping assignment (§6.7). */
export async function getActiveCleanerCount(): Promise<number> {
  const { property } = await activeProperty();
  return prisma.staffShift.count({
    where: { propertyId: property.id, clockOutAt: null, role: { in: ["housekeeper", "hk_supervisor"] } },
  });
}
