"use server";

import { revalidatePath } from "next/cache";
import { forSystem, issueToken } from "@revio/db";
import { inviteEmail } from "@revio/core";
import { sendEmail } from "@revio/email";
import { primaryProduct } from "./product-origins";
import { PLAN_BASE_MINOR, tierForRooms } from "./pricing";
import { flashError, setFlash } from "@revio/ui/flash";
import { getOperatorSession } from "./session";

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

/**
 * Override the tier the room count implies — deliberately harder than picking from a dropdown.
 *
 * `setPlan` used to write whatever was selected, with no session check and no record, while a panel
 * elsewhere measured the resulting disagreement as "unbilled tier drift". The console manufactured
 * the problem it then reported, and a hotel that opened a second building stayed on Starter forever.
 *
 * The tier is derived now. This is the exception, and it must carry a reason and a name — otherwise
 * it is the same silent dropdown with extra steps.
 */
export async function overridePlan(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change a plan.");

  const tenantId = str(fd, "tenantId");
  const plan = str(fd, "plan");
  const reason = str(fd, "reason").trim();
  if (!PLAN_BASE_MINOR[plan]) return flashError("That isn’t a plan. Reload the page and try again.");
  if (reason.length < 3) {
    // The whole point. An override with no reason is indistinguishable from the drift this replaced.
    return flashError("Say why this client is not on the tier their room count implies — an override without a reason is just drift.");
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planOverride: plan, planOverrideReason: reason.slice(0, 200),
      planOverrideById: session.name, planOverrideAt: new Date(),
      // `plan` still records what they are billed on, since invoices were generated from it.
      plan,
    },
  });
  revalidatePath("/clients");
  revalidatePath("/billing");
  await setFlash("success", `${plan} is now an explicit override, not drift.`);
}

/** Drop the override and let the room count decide again. */
export async function clearPlanOverride(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change a plan.");
  const tenantId = str(fd, "tenantId");

  const units = await prisma.unit.count({ where: { property: { tenantId } } });
  const derived = tierForRooms(units).plan;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planOverride: null, planOverrideReason: null, planOverrideById: null, planOverrideAt: null,
      // Snap `plan` to what the rooms say, so the billed value and the derived value agree the
      // moment the exception is withdrawn rather than at the next invoice run.
      plan: derived,
    },
  });
  revalidatePath("/clients");
  revalidatePath("/billing");
  await setFlash("success", `Back on ${derived}, derived from ${units} rooms.`);
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
