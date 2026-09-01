"use server";

import { revalidatePath } from "next/cache";
import { forSystem, issueToken } from "@revio/db";
import { inviteEmail } from "@revio/core";
import { sendEmail } from "@revio/email";
import { primaryProduct } from "./product-origins";

// Operator provisions clients across all tenants → bypass RLS (app.bypass=on).
const prisma = forSystem();

export type ActionResult = { ok: boolean; error?: string };

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "client";
}

/** Provision a new client: organization (tenant) + its Owner user + a first property + entitlements.
 *  This is operator-side onboarding — the client's staff are added later by the Owner, in the product. */
export async function createClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Client name is required." };
  const ownerName = str(fd, "ownerName") || "Owner";
  const ownerEmail = str(fd, "ownerEmail");
  if (!ownerEmail) return { ok: false, error: "Owner email is required." };
  const propertyName = str(fd, "propertyName") || name;
  const plan = str(fd, "plan") || "starter";

  const entitlements = {
    hasChannelManager: fd.get("hasChannelManager") != null,
    hasReservation: fd.get("hasReservation") != null,
    hasPms: fd.get("hasPms") != null,
  };
  if (!entitlements.hasChannelManager && !entitlements.hasReservation && !entitlements.hasPms) {
    return { ok: false, error: "Enable at least one product." };
  }

  if (await prisma.user.findUnique({ where: { email: ownerEmail } })) {
    return { ok: false, error: "A user with that email already exists." };
  }

  // Ensure a unique slug.
  let slug = slugify(name);
  if (await prisma.tenant.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  // The Owner is created with NO password and receives an invitation. This is the first account a
  // new client ever gets, so it is the one that most needs to be theirs alone — nobody at Revio ever
  // knows a customer's password, which was not true while every account shared one hardcoded value.
  const tenant = await prisma.tenant.create({
    data: {
      name, slug, plan, status: "active", ...entitlements,
      users: { create: [{ name: ownerName, email: ownerEmail, role: "owner" }] },
      properties: { create: [{ name: propertyName, baseCurrency: "EUR", timezone: "Europe/Sofia" }] },
    },
    include: { properties: true },
  });
  // Every new hotel starts with a base "Standard Rate" (manual) so the calendar, bulk update and
  // derived rates have a parent to work from. The Owner adds room types + more rate plans from there.
  const property = tenant.properties[0]!;
  await prisma.ratePlan.create({
    data: { tenantId: tenant.id, propertyId: property.id, name: "Standard Rate", code: "BAR", tags: ["flexible"], priceLogic: "manual", defMinLos: 1, sortOrder: 0 },
  });

  // The invitation lands on the product they bought, not on this console — which they can never
  // sign into. If the mail fails we do NOT unwind the tenant: the client exists and is correct, and
  // an operator can re-send from the client page. Losing a whole onboarding to a mail hiccup would
  // be the worse failure.
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (owner) {
    const product = primaryProduct(entitlements);
    const token = await issueToken({ purpose: "invite", email: ownerEmail, userId: owner.id });
    const mail = inviteEmail({
      name: ownerName,
      context: name,
      url: `${product.origin}/accept-invite/${token}`,
    });
    await sendEmail({ to: [ownerEmail], subject: mail.subject, text: mail.text, html: mail.html });
  }

  revalidatePath("/clients");
  revalidatePath("/overview");
  return { ok: true };
}

/** Toggle one product entitlement for a client — how products are "sold separately". */
export async function setEntitlement(tenantId: string, product: "channelManager" | "reservation" | "pms", enabled: boolean): Promise<void> {
  const field = product === "channelManager" ? "hasChannelManager" : product === "reservation" ? "hasReservation" : "hasPms";
  await prisma.tenant.update({ where: { id: tenantId }, data: { [field]: enabled } });
  revalidatePath("/clients");
  revalidatePath("/overview");
}

export async function setPlan(fd: FormData): Promise<void> {
  await prisma.tenant.update({ where: { id: str(fd, "tenantId") }, data: { plan: str(fd, "plan") } });
  revalidatePath("/clients");
}

export async function setStatus(fd: FormData): Promise<void> {
  const tenantId = str(fd, "tenantId");
  const status = str(fd, "status");
  await prisma.tenant.update({ where: { id: tenantId }, data: { status } });
  revalidatePath("/clients");
  revalidatePath("/overview");
}

/**
 * Mark a client as ours-for-testing, or promote it to a real one.
 *
 * Reversible on purpose, both ways. A demo hotel that becomes a paying customer keeps its entire
 * history — bookings, folios, notes — instead of starting again on a fresh tenant; and a real client
 * can be borrowed for a test without inventing one. Nothing about the hotel's own experience changes
 * either way: the flag only decides whether this console counts them as business (see lib/demo.ts).
 */
export async function setDemo(fd: FormData): Promise<void> {
  const tenantId = str(fd, "tenantId");
  await prisma.tenant.update({ where: { id: tenantId }, data: { isDemo: str(fd, "isDemo") === "true" } });
  revalidatePath(`/clients/${tenantId}`);
  revalidatePath("/clients");
  revalidatePath("/overview");
  revalidatePath("/plans");
  revalidatePath("/billing");
}
