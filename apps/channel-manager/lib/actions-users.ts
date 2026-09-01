"use server";

import { headers } from "next/headers";
import { issueToken } from "@revio/db";
import { inviteEmail } from "@revio/core";
import { sendEmail } from "@revio/email";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { str } from "./mutation-helpers";
import { guard, requireCapability } from "./authz";
import { flashError } from "@revio/ui/flash";

export type ActionResult = { ok: boolean; error?: string };

const ROLES = ["owner", "admin", "revenue_manager", "distribution_manager", "read_only"] as const;

/** Only an Owner or Admin may manage users/properties. Returns the session or null. */
async function requireManager() {
  const s = await getSession();
  if (!s || (s.role !== "owner" && s.role !== "admin")) return null;
  return s;
}

export async function inviteUser(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageStaff");
  if (!_g.ok) return { ok: false, error: _g.error };
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner or Admin can manage users." };

  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  if (!name || !email) return { ok: false, error: "Name and email are required." };
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { ok: false, error: "Pick a valid role." };
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "A user with that email already exists." };

  // No password. The account is unusable until the invitee sets one from the emailed link.
  const user = await prisma.user.create({ data: { tenantId: s.tenantId, name, email, role } });
  await sendInvite({ email, name, userId: user.id, hotel: s.tenantName, ...(s.userName ? { invitedBy: s.userName } : {}) });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateUserRole(fd: FormData): Promise<void> {
  await requireCapability("manageStaff");
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (!ROLES.includes(role as (typeof ROLES)[number])) return flashError("That isn’t a role this account has. Reload the page and try again.");

  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId) return; // never touch another tenant's user
  // Don't demote the last remaining owner.
  if (u.role === "owner" && role !== "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner" } });
    if (owners <= 1) return flashError("This is the last owner. Make somebody else an owner first — an account with no owner cannot be managed.");
  }
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
}

export async function removeUser(fd: FormData): Promise<void> {
  await requireCapability("manageStaff");
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.tenantId !== s.tenantId || u.id === s.userId) return; // can't remove cross-tenant or yourself
  if (u.role === "owner") {
    const owners = await prisma.user.count({ where: { tenantId: s.tenantId, role: "owner" } });
    if (owners <= 1) return flashError("This is the last owner. Make somebody else an owner first — an account with no owner cannot be managed.");
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function addProperty(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const _g = await guard("manageSettings");
  if (!_g.ok) return { ok: false, error: _g.error };
  const s = await requireManager();
  if (!s) return { ok: false, error: "Only an Owner or Admin can add a property." };
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Property name is required." };
  await prisma.property.create({
    data: { tenantId: s.tenantId, name, baseCurrency: str(fd, "baseCurrency") || "EUR", timezone: str(fd, "timezone") || "Europe/Sofia" },
  });
  revalidatePath("/settings");
  return { ok: true };
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
  await sendEmail({ to: [args.email], subject: mail.subject, text: mail.text, html: mail.html });
}
