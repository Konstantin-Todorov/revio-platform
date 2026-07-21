"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@revio/db";
import { prisma } from "./db";
import { hashPassword } from "./auth";
import { getSession } from "./session";
import { str } from "./mutation-helpers";

/**
 * CRS Staff — user management on the ONE shared identity (CRS-REFINEMENT-R2 §8.2). Every operation
 * here writes the same shared-core `User` used by RevioLink and RevioPMS — never a CRS-local user
 * store. Roles come from the shared CM/CRS taxonomy. We prefer deactivate over hard-delete (audit
 * trail), and password reset uses the shared credential (demo: the shared demo password; production:
 * emails a reset link).
 */

export type ActionResult = { ok: boolean; error?: string };

// The account-level roles shared across CM + CRS. (PMS operational roles live on the same identity but
// are assigned from the PMS surface; the CRS Staff tab manages the commercial roles.)
const ROLES = ["owner", "admin", "revenue_manager", "distribution_manager", "read_only"] as const;
const isRole = (r: string) => (ROLES as readonly string[]).includes(r);

/** Only an Owner or Admin may manage staff. Returns the session or null. */
async function requireManager() {
  const s = await getSession();
  if (!s || (s.role !== "owner" && s.role !== "admin")) return null;
  return s;
}

/** Add a user to the shared identity, scoped to this tenant + role. */
export async function inviteUser(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner or Admin can manage staff." };

  const name = str(fd, "name").trim();
  const email = str(fd, "email").toLowerCase().trim();
  const phone = str(fd, "phone").trim() || null;
  const role = str(fd, "role");
  if (!name || !email) return { ok: false, error: "Name and email are required." };
  if (!isRole(role)) return { ok: false, error: "Pick a valid role." };

  // Demo: new staff get the shared demo password. Production: email an invite link to set their own.
  const passwordHash = await hashPassword("revio1234");
  try {
    await prisma.user.create({ data: { tenantId: s.tenantId, name, email, phone, role, passwordHash } });
  } catch (e) {
    // email is globally unique on the shared identity — RLS hides other tenants' rows, so a cross-tenant
    // collision only shows up here.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That email is already a Revio login." };
    }
    throw e;
  }
  revalidatePath("/settings");
  return { ok: true };
}

/** Edit a user's profile on the shared identity: name, email (the login contact), phone. */
export async function updateUser(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner or Admin can manage staff." };

  const id = str(fd, "id");
  const name = str(fd, "name").trim();
  const email = str(fd, "email").toLowerCase().trim();
  const phone = str(fd, "phone").trim() || null;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return { ok: false, error: "User not found." };
  if (!name || !email) return { ok: false, error: "Name and email are required." };

  try {
    await prisma.user.update({ where: { id }, data: { name, email, phone } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That email is already a Revio login." };
    }
    throw e;
  }
  revalidatePath("/settings");
  return { ok: true };
}

/** Inline role change. Guards the last remaining owner from being demoted. */
export async function updateUserRole(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (!isRole(role)) return;

  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return;
  if (u.role === "owner" && role !== "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner", active: true } });
    if (owners <= 1) return;
  }
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
}

/** Deactivate / reactivate — preferred over hard-delete. A deactivated user keeps their identity and
 * history but can't sign in. Can't deactivate yourself or the last active owner. */
export async function setUserActive(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const active = str(fd, "active") === "true";
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return;
  if (!active && u.id === s.userId) return; // don't lock yourself out
  if (!active && u.role === "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner", active: true } });
    if (owners <= 1) return; // keep at least one active owner
  }
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/settings");
}

/** Reset a user's password on the SHARED credential. Demo: resets to the shared demo password.
 * Production: this is where an emailed reset link would be triggered (preferred over a plaintext temp). */
export async function resetUserPassword(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return;
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword("revio1234") } });
  revalidatePath("/settings");
}
