"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { takeUnitOoo, clearUnitOoo } from "./units";
import { logAudit, str } from "./mutation-helpers";
import { recordOpsEvent } from "./events";

async function ctx() {
  const session = await getSession();
  if (!session) throw new Error("No session");
  return session;
}

function refresh() {
  revalidatePath("/maintenance");
  revalidatePath("/housekeeping");
  revalidatePath("/dashboard");
}

const PRIORITIES = ["low", "normal", "high"];
// Maintenance lifecycle (§8.3): Reported(open) → In progress → On hold (awaiting parts) → Done.
const STATUSES = ["open", "in_progress", "on_hold", "done"];

/** Log a maintenance task; ticking "out of order" takes the unit off sale via the shared waterfall. */
export async function createMaintenanceTask(fd: FormData): Promise<void> {
  const session = await ctx();
  const title = str(fd, "title");
  const unitId = str(fd, "unitId") || null;
  const priority = PRIORITIES.includes(str(fd, "priority")) ? str(fd, "priority") : "normal";
  const assignee = str(fd, "assignee") || null;
  const ooo = fd.get("ooo") != null;
  if (!title) redirect("/maintenance?error=title");

  let setsOoo = false;
  if (ooo && unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId: session.activePropertyId }, select: { id: true, label: true, roomTypeId: true } });
    if (unit) {
      await takeUnitOoo(session.tenantId, session.activePropertyId, unit, `Maintenance: ${title}`);
      setsOoo = true;
    }
  }
  await prisma.maintenanceTask.create({
    data: { tenantId: session.tenantId, propertyId: session.activePropertyId, unitId, title, priority, assignee, setsOoo, createdById: session.userId },
  });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "maintenance", field: "create", newValue: `${title}${setsOoo ? " (OOO)" : ""}`, userId: session.userId });
  refresh();
}

/** Move a task through open → in_progress → done. Completing an OOO task returns the room (as Dirty). */
export async function setMaintenanceStatus(fd: FormData): Promise<void> {
  const session = await ctx();
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!STATUSES.includes(status)) return;
  const task = await prisma.maintenanceTask.findFirst({ where: { id, propertyId: session.activePropertyId }, include: { unit: { select: { id: true, label: true } } } });
  if (!task) return;

  await prisma.maintenanceTask.update({ where: { id }, data: { status, completedAt: status === "done" ? new Date() : null } });
  if (status === "done" && task.setsOoo && task.unit) {
    await clearUnitOoo(session.tenantId, session.activePropertyId, { id: task.unit.id, label: task.unit.label }, "dirty");
    await prisma.maintenanceTask.update({ where: { id }, data: { setsOoo: false } });
  }
  await logAudit(session.activePropertyId, session.tenantId, { entity: "maintenance", field: task.title, newValue: status, userId: session.userId });
  // Maintenance event stream (§8.7) — powers the manager-only maintenance analytics (tasks/tech, time-to-resolve).
  await recordOpsEvent({
    propertyId: session.activePropertyId, tenantId: session.tenantId, domain: "maintenance",
    action: "status_change", unitId: task.unitId, actorId: session.userId,
    fromState: task.status, toState: status, refId: task.id,
  });
  refresh();
}

/** Attach (or replace) a photo of the fault (spec §3.8). The client downscales to a small JPEG data
 * URL before posting; we cap the stored size so the demo DB stays lean. Empty clears the photo. */
export async function setTaskPhoto(fd: FormData): Promise<void> {
  const session = await ctx();
  const id = str(fd, "id");
  const photoUrl = str(fd, "photoUrl");
  const task = await prisma.maintenanceTask.findFirst({ where: { id, propertyId: session.activePropertyId }, select: { id: true, title: true } });
  if (!task) return;
  // Accept only a data-URL image, and only up to ~1.5MB (a downscaled JPEG is far smaller).
  const value = photoUrl && /^data:image\/(png|jpe?g|webp);base64,/.test(photoUrl) && photoUrl.length < 1_500_000 ? photoUrl : null;
  await prisma.maintenanceTask.update({ where: { id }, data: { photoUrl: value } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "maintenance", field: task.title, newValue: value ? "photo attached" : "photo removed", userId: session.userId });
  refresh();
}

/** Delete a task; if it had the unit out of order, return the room to sale (as Dirty). */
export async function deleteMaintenanceTask(fd: FormData): Promise<void> {
  const session = await ctx();
  const id = str(fd, "id");
  const task = await prisma.maintenanceTask.findFirst({ where: { id, propertyId: session.activePropertyId }, include: { unit: { select: { id: true, label: true } } } });
  if (!task) return;
  if (task.setsOoo && task.unit) {
    await clearUnitOoo(session.tenantId, session.activePropertyId, { id: task.unit.id, label: task.unit.label }, "dirty");
  }
  await prisma.maintenanceTask.delete({ where: { id } });
  await logAudit(session.activePropertyId, session.tenantId, { entity: "maintenance", field: "delete", oldValue: task.title, userId: session.userId });
  refresh();
}
