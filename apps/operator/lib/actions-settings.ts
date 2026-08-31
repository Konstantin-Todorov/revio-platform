"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { forSystem, issueToken } from "@revio/db";
import { inviteEmail } from "@revio/core";
import { sendEmail } from "@revio/email";
import { getOperatorSession } from "./session";
import { flashError } from "@revio/ui/flash";

const prisma = forSystem();

const ROLES = ["super_admin", "support"];

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** Invite an operator staff member. Demo: they get the shared demo password and can log in at once. */
export async function inviteOperator(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  // Only super admins manage staff.
  if (session?.role !== "super_admin") return flashError("Only a super admin can manage operator accounts.");
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const role = ROLES.includes(str(fd, "role")) ? str(fd, "role") : "support";
  if (!name || !email) return;

  const exists = await prisma.operatorUser.findUnique({ where: { email } });
  if (exists) return;
  // No password — our own staff get the same invitation flow as a hotel's. An admin console whose
  // accounts are created with a password someone else typed is the account most worth stealing.
  const created = await prisma.operatorUser.create({ data: { name, email, role } });

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const token = await issueToken({ purpose: "invite", email, operatorUserId: created.id });
  const mail = inviteEmail({
    name,
    context: "the Revio operator console",
    ...(session.name ? { invitedBy: session.name } : {}),
    url: `${proto}://${host}/accept-invite/${token}`,
  });
  await sendEmail({ to: [email], subject: mail.subject, text: mail.text });

  revalidatePath("/settings");
}

/** Change an operator's role — never leave the console without a super_admin. */
export async function updateOperatorRole(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (session?.role !== "super_admin") return flashError("Only a super admin can manage operator accounts.");
  const id = str(fd, "id");
  const role = ROLES.includes(str(fd, "role")) ? str(fd, "role") : "support";
  const target = await prisma.operatorUser.findUnique({ where: { id } });
  if (!target) return;
  if (target.role === "super_admin" && role !== "super_admin") {
    const admins = await prisma.operatorUser.count({ where: { role: "super_admin" } });
    // Keep at least one super admin — the last one cannot lock everybody out.
    if (admins <= 1) return flashError("This is the last super admin. Promote somebody else first, or there would be nobody who can manage accounts.");
  }
  await prisma.operatorUser.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
}

/** Remove an operator — can't remove yourself or the last super admin. */
export async function removeOperator(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (session?.role !== "super_admin") return flashError("Only a super admin can manage operator accounts.");
  const id = str(fd, "id");
  if (id === session.userId) return; // no self-removal
  const target = await prisma.operatorUser.findUnique({ where: { id } });
  if (!target) return;
  if (target.role === "super_admin") {
    const admins = await prisma.operatorUser.count({ where: { role: "super_admin" } });
    if (admins <= 1) return flashError("This is the last super admin. Promote somebody else first, or there would be nobody who can manage accounts.");
  }
  await prisma.operatorUser.delete({ where: { id } });
  revalidatePath("/settings");
}
