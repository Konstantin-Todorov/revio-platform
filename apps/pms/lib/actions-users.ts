"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { hashPassword } from "./auth";
import { getSession } from "./session";
import { str } from "./mutation-helpers";
import { PMS_ROLES, MANAGER_ROLES, type PmsRole } from "./roles";

export type ActionResult = { ok: boolean; error?: string };

/** Only an Owner / Admin / Manager may manage staff. */
async function requireManager() {
  const s = await getSession();
  if (!s || !MANAGER_ROLES.has(s.role)) return null;
  return s;
}

export async function inviteStaff(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner, Admin or Manager can manage staff." };

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  if (!name || !email) return { ok: false, error: "Name and email are required." };
  if (!PMS_ROLES.includes(role as PmsRole)) return { ok: false, error: "Pick a valid role." };
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "A person with that email already exists on the platform." };

  // Demo: new staff get the shared demo password. Production emails an invite link to set their own.
  const passwordHash = await hashPassword("revio1234");
  await prisma.user.create({ data: { tenantId: s.tenantId, name, email, role, passwordHash, active: true } });
  revalidatePath("/users");
  return { ok: true };
}

export async function setStaffRole(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (!PMS_ROLES.includes(role as PmsRole)) return;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return;
  // Never demote the last remaining owner.
  if (u.role === "owner" && role !== "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner", active: true } });
    if (owners <= 1) return;
  }
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/users");
}

/** Deactivate / reactivate a person — keeps their shared identity but blocks sign-in everywhere. */
export async function setStaffActive(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const active = fd.get("active") === "true";
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId || u.id === s.userId) return; // never deactivate yourself
  if (!active && u.role === "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner", active: true } });
    if (owners <= 1) return; // keep at least one active owner
  }
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/users");
}
