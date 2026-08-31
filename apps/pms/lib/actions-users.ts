"use server";

import { headers } from "next/headers";
import { issueToken } from "@revio/db";
import { inviteEmail } from "@revio/core";
import { sendEmail } from "@revio/email";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { str } from "./mutation-helpers";
import { PMS_ROLES, MANAGER_ROLES, type PmsRole } from "./roles";
import { flashError } from "@revio/ui/flash";

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

  // No password. The account is unusable until the invitee sets one from the emailed link.
  const user = await prisma.user.create({ data: { tenantId: s.tenantId, name, email, role, active: true } });
  await sendInvite({ email, name, userId: user.id, hotel: s.tenantName, ...(s.userName ? { invitedBy: s.userName } : {}) });
  revalidatePath("/users");
  return { ok: true };
}

export async function setStaffRole(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (!PMS_ROLES.includes(role as PmsRole)) return flashError("That isn’t a role this property has. Reload the page and try again.");
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
