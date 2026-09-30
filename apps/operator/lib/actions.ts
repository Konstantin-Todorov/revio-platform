"use server";

import { defaultRatePlanName } from "@revio/core";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { claimSubmitToken, deleteClientCompletely, describeBilling, forSystem, issueToken, recordAppError, withSystemTransaction } from "@revio/db";
import { ACCOUNT_TYPE_BY_KEY, defaultBillingFor, initialGuestLanguage, inviteEmail, isAccountType, isOurs, statusView, type AccountType } from "@revio/core";
import { sendEmail } from "@revio/email";
import { primaryProduct } from "./product-origins";
import { PLAN_BASE_MINOR, tierForRooms } from "./pricing";
import { flashError, setFlash } from "@revio/ui/flash";
import { getOperatorSession } from "./session";

// Operator provisions clients across all tenants → bypass RLS (app.bypass=on).
const prisma = forSystem();

export type ActionResult = {
  ok: boolean;
  error?: string;
  /** Where the refusal can be resolved — e.g. the client that already owns an email. */
  link?: { href: string; label: string };
};

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "client";
}

/** Provision a new client: organization (tenant) + its Owner user + a first property + entitlements.
 *  This is operator-side onboarding — the client's staff are added later by the Owner, in the product. */
export async function createClient(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Sign in again to create a client." };
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "Client name is required." };
  const ownerName = str(fd, "ownerName") || "Owner";
  // ⚠️ Lower-cased like every other login path. Sign-in lower-cases what it is typed and looks it up
  // exactly, so an owner stored as "Ivan@Hotel.bg" could never have signed in.
  const ownerEmail = str(fd, "ownerEmail").toLowerCase();
  if (!ownerEmail) return { ok: false, error: "Owner email is required." };
  const propertyName = str(fd, "propertyName") || name;
  const plan = str(fd, "plan") || "starter";
  // What kind of account — chosen here, deliberately, never flipped later by accident.
  const accountType: AccountType = isAccountType(str(fd, "accountType")) ? (str(fd, "accountType") as AccountType) : "live";
  const billingMode = defaultBillingFor(accountType);
  // A pilot is free for three months unless a date is given; the date is on the client page to change.
  const freeUntilRaw = str(fd, "freeUntil");
  const freeUntil = billingMode === "free"
    ? (freeUntilRaw ? new Date(`${freeUntilRaw}T00:00:00Z`) : new Date(Date.now() + 91 * 86_400_000))
    : null;
  if (freeUntil && Number.isNaN(freeUntil.getTime())) return { ok: false, error: "The free-until date is not a date. Pick one from the calendar." };
  // Chosen on the form; English unless it is a language we send in (`initialGuestLanguage`).
  const language = initialGuestLanguage(str(fd, "language"));

  const entitlements = {
    hasChannelManager: fd.get("hasChannelManager") != null,
    hasReservation: fd.get("hasReservation") != null,
    hasPms: fd.get("hasPms") != null,
  };
  if (!entitlements.hasChannelManager && !entitlements.hasReservation && !entitlements.hasPms) {
    return { ok: false, error: "Enable at least one product." };
  }

  /*
   * ⚠️ Say WHOSE email it is, and where to go.
   *
   * This said only "A user with that email already exists." On 2026-09-26 two colleagues tried to
   * re-add a hotel whose earlier account still existed (suspended, its deletion had failed), got
   * that sentence above an emptied form, and gave up. Nothing on the screen said the address
   * belonged to a client they could open, reinstate or delete.
   */
  const existing = await prisma.user.findFirst({
    where: { email: { equals: ownerEmail, mode: "insensitive" } },
    select: { tenant: { select: { id: true, name: true, status: true, isDemo: true } } },
  });
  if (existing) {
    const t = existing.tenant;
    const state = statusView(t.status, null).label.toLowerCase();
    return {
      ok: false,
      error:
        `${ownerEmail} is already a login at ${t.name}${t.isDemo ? " (demo)" : ""}, which is ${state}. ` +
        (t.status === "suspended" || t.status === "closed"
          ? `If this is the same hotel coming back, ${t.status === "closed" ? "reopen" : "reinstate"} that client instead of creating a new one — everything they had is still there.`
          : "One email can belong to one client. Use a different address for this owner, or open that client."),
      link: { href: `/clients/${t.id}`, label: `Open ${t.name}` },
    };
  }

  // Ensure a unique slug.
  let slug = slugify(name);
  if (await prisma.tenant.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  // The Owner is created with NO password and receives an invitation. This is the first account a
  // new client ever gets, so it is the one that most needs to be theirs alone — nobody at Revio ever
  // knows a customer's password, which was not true while every account shared one hardcoded value.
  /*
   * One transaction: the client and its base "Standard Rate" (manual — so the calendar, bulk update
   * and derived rates have a parent to work from) exist together or not at all. They were two
   * separate writes, and a failure between them left a client with no plan whose owner email then
   * blocked every retry.
   */
  // A second press of the same form is not a second client. Without this it reached the owner's
  // unique email and came back as "that email is taken" — read as a failure while the client existed.
  if (!(await claimSubmitToken(forSystem(), fd, null, "createClient"))) return { ok: true };

  await withSystemTransaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name, slug, plan, status: "active", ...entitlements,
        accountType, isDemo: isOurs(accountType), billingMode, freeUntil,
        users: { create: [{ name: ownerName, email: ownerEmail, role: "owner", ...(language !== "en" ? { locale: language } : {}) }] },
        properties: { create: [{ name: propertyName, baseCurrency: "EUR", timezone: "Europe/Sofia", defaultLanguage: language }] },
      },
      include: { properties: true },
    });
    const property = tenant.properties[0]!;
    await tx.clientEvent.create({
      data: {
        tenantId: tenant.id, kind: "created", toValue: `${ACCOUNT_TYPE_BY_KEY[accountType].label} · ${describeBilling(billingMode, freeUntil)}`,
        actorId: session.userId, actorName: session.name,
      },
    });
    await tx.ratePlan.create({
      data: { tenantId: tenant.id, propertyId: property.id, name: defaultRatePlanName(language), code: "BAR", tags: ["flexible"], priceLogic: "manual", defMinLos: 1, sortOrder: 0 },
    });
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
      locale: language,
    });
    const sent = await sendEmail({ to: [ownerEmail], subject: mail.subject, text: mail.text, html: mail.html });
    // Say what happened. The dialog used to close with no word at all, so an operator could not tell
    // whether the owner had been invited — the one thing they have to be able to tell the client.
    await setFlash(
      sent.ok ? "success" : "error",
      sent.ok
        ? `${name} created. The invitation went to ${ownerEmail} — the link opens ${product.name}, where they set their own password.`
        : `${name} created, but the invitation email did not go out (${sent.error ?? "no answer from the mail service"}). Send it again from the client's People tab.`,
    );
  }

  revalidatePath("/clients");
  revalidatePath("/overview");
  return { ok: true };
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

/**
 * Remove a client entirely.
 *
 * ## Why the console needed this at all
 *
 * There was no way to delete a client from anywhere — not a demo tenant, not a smoke test, not a
 * signup somebody abandoned. The only tool was a suspension, which is the right answer for a hotel
 * that left and the wrong one for a row that should never have existed.
 *
 * ## The three guards, and why none of them is the screen's job
 *
 * The screen shows a warning; this enforces the rule. A page open since before an invoice was sent
 * would otherwise delete a tax record on the strength of a check made minutes ago. So
 * `deleteClientCompletely` re-reads the facts, re-runs `canDeleteClient`, and re-checks the typed
 * name — all inside the same call that does the deleting.
 *
 * What it deletes is deliberately more than `tenant.delete()`: six tenant-scoped tables carry no
 * foreign key to `Tenant` and survive the cascade, one of them holding encrypted OTA credentials.
 */
export async function deleteClient(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to remove a client.");

  /*
   * ⚠️ Super-admin only, and it is the ONLY action in this console with a role gate.
   *
   * Everything else here is reversible in a click — an entitlement goes back on, a plan override is
   * re-edited, a note is rewritten. This one is not reversible by anybody, at any time, and a
   * support account exists to answer questions rather than to end a hotel.
   */
  if (session.role !== "super_admin") {
    return flashError("Only a super admin can remove a client. Ask one, or suspend the account instead.");
  }

  const tenantId = String(fd.get("tenantId") ?? "");
  const confirmation = String(fd.get("confirmation") ?? "");
  if (!tenantId) return flashError("No client named.");

  /*
   * ⚠️ An unexpected failure is said on THIS page, not by replacing it with a crash screen.
   *
   * On 2026-09-26 a database refusal here threw straight out of the action and the operator lost the
   * whole screen mid-meeting. The deletion is one transaction, so a failure changed nothing — which is
   * exactly what the operator needs to hear, in a sentence, beside the button they pressed. It is
   * still filed in the error log, so it is fixed rather than just survived.
   */
  let result: Awaited<ReturnType<typeof deleteClientCompletely>>;
  try {
    result = await deleteClientCompletely({
      tenantId,
      confirmation,
      operatorUserId: session.userId,
      operatorName: session.name,
    });
  } catch (error) {
    await recordAppError({ service: "operator", error, route: `/clients/${tenantId} (delete)` });
    return flashError("The client could not be removed, and nothing was changed — the attempt was rolled back. The failure is in the error log.");
  }

  if (!result.ok) return flashError(result.message ?? "That client could not be removed.");

  // Straight to the list: the page we were on describes a hotel that no longer exists.
  revalidatePath("/clients");
  revalidatePath("/overview");
  await setFlash("success", "Client removed. Everything it owned went with it.");
  redirect("/clients");
}
