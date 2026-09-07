"use server";

import { revalidatePath } from "next/cache";
import { forSystem, issueToken } from "@revio/db";
import { inviteEmail, renderSystemEmail, renderSystemEmailText, PRODUCT_BY_KEY } from "@revio/core";
import { sendEmail } from "@revio/email";
import { originFor, primaryProduct } from "./product-origins";
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
  if (!(await getOperatorSession())) return { ok: false, error: "Sign in again to create a client." };
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

/**
 * Grant or withdraw one product for a client.
 *
 * This is the most consequential switch in the console: it decides whether a hotel can open a
 * product at all. Until 2026-09-07 it was a bare boolean write with **no session check, no record
 * and no word to the customer** — and it had never been scanned by `authz-lint`, because that check
 * matched `actions-*.ts` and this file is `actions.ts`.
 *
 * The cost was not theoretical. Hotel Sofia Group lost RevioLink and RevioCRS during a founder's dry
 * run and nothing anywhere said who had done it, when, or why; the demo hotel simply stopped
 * opening, and it read as a connectivity fault.
 *
 * Four things now happen, and each exists because of a specific way this goes wrong:
 *
 *  1. **A session is required.** It is a POST endpoint like any other.
 *  2. **A no-op writes nothing.** Re-saving a form that changed nothing must not produce a record
 *     claiming access changed, or the audit trail becomes as untrustworthy as no audit trail.
 *  3. **The change is recorded in the HOTEL's own audit log**, not only ours. The person who has to
 *     answer "why did RevioCRS stop working this morning?" is at the hotel.
 *  4. **The hotel is told.** Access appearing or vanishing without a word is how a customer decides
 *     the software is unreliable. Granting says where to go; withdrawing says plainly that their
 *     data is untouched — which is true, because an entitlement is a licence and the data is shared.
 *
 * Deliberately NOT added: a confirmation step. The operator is staff, the action is reversible in one
 * click, and a dialog on every toggle trains people to dismiss dialogs.
 */
export async function setEntitlement(tenantId: string, product: "channelManager" | "reservation" | "pms", enabled: boolean): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change a client's products.");

  const field = product === "channelManager" ? "hasChannelManager" : product === "reservation" ? "hasReservation" : "hasPms";

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      properties: { orderBy: { name: "asc" }, take: 1, select: { id: true } },
      users: { where: { role: "owner", active: true }, take: 1, select: { email: true, name: true } },
    },
  });
  if (!tenant) return flashError("That client no longer exists.");

  // Nothing to do — and nothing to record. See (2) above.
  if (tenant[field] === enabled) return;

  await prisma.tenant.update({ where: { id: tenantId }, data: { [field]: enabled } });

  const info = PRODUCT_BY_KEY[product === "channelManager" ? "cm" : product === "reservation" ? "crs" : "pms"];

  const propertyId = tenant.properties[0]?.id;
  if (propertyId) {
    await prisma.auditEntry.create({
      data: {
        tenantId, propertyId,
        entity: "Product access", field: info.name,
        oldValue: enabled ? "no access" : "access",
        newValue: `${enabled ? "granted" : "withdrawn"} by ${session.name} (Revio)`,
        source: "manual",
      },
    });
  }

  const owner = tenant.users[0];
  if (owner?.email) {
    const mail = enabled
      ? {
          preview: `${info.name} is now available to your team.`,
          heading: `${info.name} is switched on`,
          product: info.name,
          blocks: [
            { p: `${info.name} is now available on your existing Revio login — ${info.tagline.toLowerCase()}.` },
            { p: "There is nothing to import and nothing to set up: your rooms, rates and guests are already there, because every Revio product shares one system." },
            { action: { label: `Open ${info.name}`, url: originFor(product === "channelManager" ? "cm" : product === "reservation" ? "crs" : "pms") } },
            { note: "Everyone on your team signs in with the account they already use." },
          ],
        }
      : {
          preview: `${info.name} has been switched off for your account.`,
          heading: `${info.name} has been switched off`,
          product: info.name,
          blocks: [
            { p: `${info.name} is no longer available on your Revio login.` },
            { p: "Your data has not been touched. Rooms, rates, reservations and guests are shared across every Revio product and stay exactly as they are — switching this back on restores access immediately, with nothing to re-import." },
            { note: "If this was not expected, reply to this email and we will put it back." },
          ],
        };

    // Never block the change on the mail provider: the access is already correct either way.
    try {
      await sendEmail({
        to: [owner.email],
        subject: enabled ? `${info.name} is switched on for ${tenant.name}` : `${info.name} has been switched off`,
        text: renderSystemEmailText(mail),
        html: renderSystemEmail(mail),
      });
    } catch { /* recorded above; the audit entry is the durable record */ }
  }

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
  if (!(await getOperatorSession())) return flashError("Sign in again to change a client's status.");
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
  if (!(await getOperatorSession())) return flashError("Sign in again to change the demo flag.");
  const tenantId = str(fd, "tenantId");
  await prisma.tenant.update({ where: { id: tenantId }, data: { isDemo: str(fd, "isDemo") === "true" } });
  revalidatePath(`/clients/${tenantId}`);
  revalidatePath("/clients");
  revalidatePath("/overview");
  revalidatePath("/plans");
  revalidatePath("/billing");
}
