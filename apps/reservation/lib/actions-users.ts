"use server";

import { headers } from "next/headers";
import { issueToken } from "@revio/db";
import { inviteEmail } from "@revio/core";
import { sendEmail } from "@revio/email";

import { revalidatePath } from "next/cache";
import { Prisma } from "@revio/db";
import { prisma } from "./db";
import { getSession } from "./session";
import { str } from "./mutation-helpers";
import { guard, requireCapability } from "./authz";

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
  const _g = await guard("manageStaff");
  if (!_g.ok) return { ok: false, error: _g.error };
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner or Admin can manage staff." };

  const name = str(fd, "name").trim();
  const email = str(fd, "email").toLowerCase().trim();
  const phone = str(fd, "phone").trim() || null;
  const role = str(fd, "role");
  if (!name || !email) return { ok: false, error: "Name and email are required." };
  if (!isRole(role)) return { ok: false, error: "Pick a valid role." };

  // No password. The account is unusable until the invitee sets one from the emailed link.
  try {
    const user = await prisma.user.create({ data: { tenantId: s.tenantId, name, email, phone, role } });
    await sendInvite({ email, name, userId: user.id, hotel: s.tenantName, ...(s.userName ? { invitedBy: s.userName } : {}) });
  } catch (e) {
    // email is globally unique on the shared identity — RLS hides other tenants' rows, so a cross-tenant
    // collision only shows up here.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That email is already a Revio login." };
    }
    throw e;
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
  return { ok: true };
}

/** Edit a user's profile on the shared identity: name, email (the login contact), phone. */
export async function updateUser(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageStaff");
  if (!_g.ok) return { ok: false, error: _g.error };
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
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
  return { ok: true };
}

/** Inline role change. Guards the last remaining owner from being demoted. */
export async function updateUserRole(fd: FormData): Promise<void> {
  await requireCapability("manageStaff");
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
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
}

/** Deactivate / reactivate — preferred over hard-delete. A deactivated user keeps their identity and
 * history but can't sign in. Can't deactivate yourself or the last active owner. */
export async function setUserActive(fd: FormData): Promise<void> {
  await requireCapability("manageStaff");
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
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
}

/** Reset a user's password on the SHARED credential. Demo: resets to the shared demo password.
 * Production: this is where an emailed reset link would be triggered (preferred over a plaintext temp). */
export async function resetUserPassword(fd: FormData): Promise<void> {
  await requireCapability("manageStaff");
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return;
  // A "reset" that sets a password an owner knows is not a reset — it is a way for one person to
  // enter another's account. This clears the password and sends the invite flow instead, so the
  // staff member chooses their own and nobody else ever holds it.
  await prisma.user.update({ where: { id }, data: { passwordHash: null } });
  await sendInvite({ email: u.email, name: u.name ?? u.email, userId: u.id, hotel: s.tenantName });
  revalidatePath("/settings");
  revalidatePath("/", "layout"); // Y2: clear every route's client cache, not only the ones named above
}

/**
 * Send an invitation instead of assigning a password.
 *
 * The account is created with NO password and cannot be signed into until the invitee sets one, so
 * nobody — not the owner who invited them, not us — ever knows another person's password. That was
 * not true until N2: every account on the platform shared one hardcoded value.
 */
async function sendInvite(args: {
  email: string;
  name: string;
  userId: string;
  invitedBy?: string;
  /** The hotel they are joining — what makes the email recognisable to someone new to Revio. */
  hotel: string;
}): Promise<void> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const token = await issueToken({ purpose: "invite", email: args.email, userId: args.userId });
  const mail = inviteEmail({
    name: args.name,
    context: args.hotel,
    ...(args.invitedBy ? { invitedBy: args.invitedBy } : {}),
    url: `${proto}://${host}/accept-invite/${token}`,
  });
  await sendEmail({ to: [args.email], subject: mail.subject, text: mail.text });
}
