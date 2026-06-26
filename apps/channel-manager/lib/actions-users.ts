"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@revio/db";
import { hashPassword } from "./auth";
import { getSession } from "./session";
import { str } from "./mutation-helpers";

export type ActionResult = { ok: boolean; error?: string };

const ROLES = ["owner", "admin", "revenue_manager", "distribution_manager", "read_only"] as const;

/** Only an Owner or Admin may manage users/properties. Returns the session or null. */
async function requireManager() {
  const s = await getSession();
  if (!s || (s.role !== "owner" && s.role !== "admin")) return null;
  return s;
}

export async function inviteUser(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner or Admin can manage users." };

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  if (!name || !email) return { ok: false, error: "Name and email are required." };
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { ok: false, error: "Pick a valid role." };
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "A user with that email already exists." };

  // Demo: new staff get the shared demo password. Production: email an invite link to set their own.
  const passwordHash = await hashPassword("revio1234");
  await prisma.user.create({ data: { tenantId: s.tenantId, name, email, role, passwordHash } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateUserRole(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (!ROLES.includes(role as (typeof ROLES)[number])) return;

  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return; // never touch another tenant's user
  // Don't demote the last remaining owner.
  if (u.role === "owner" && role !== "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner" } });
    if (owners <= 1) return;
  }
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
}

export async function removeUser(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId || u.id === s.userId) return; // can't remove cross-tenant or yourself
  if (u.role === "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner" } });
    if (owners <= 1) return; // keep at least one owner
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function addProperty(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner or Admin can add a property." };
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Property name is required." };
  await prisma.property.create({
    data: { tenantId: s.tenantId, name, baseCurrency: str(fd, "baseCurrency") || "EUR", timezone: str(fd, "timezone") || "Europe/Sofia" },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout"); // refresh the workspace switcher
  return { ok: true };
}
