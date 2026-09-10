"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { forSystem, encryptSecret } from "@revio/db";
import { flashError, setFlash } from "@revio/ui/flash";
import { getOperatorSession } from "./session";
import { checkStripeKey } from "./stripe-check";
import { readStripeSecret, readStripeWebhookSecret, activeStripeMode } from "./integrations";
import { createCheckoutSession, isLinkLive } from "./stripe-checkout";
import { isStripeMode, validateSecretKey, validatePublishableKey, validateWebhookSecret } from "./stripe-key";
import { isVatRegistration } from "./vat";

// Platform credentials are operator-perimeter data (bypass-only RLS) — always via forSystem.
const prisma = forSystem();

export type ActionResult = { ok: boolean; error?: string; warning?: string };

/**
 * Store a Stripe secret key — encrypted, tested first, and never echoed back.
 *
 * ## Tested BEFORE it is stored, and a rejected key is refused rather than saved
 *
 * Straight from `setConnectivityKey`, which learned it on 2026-09-01: storing whatever was pasted
 * meant a dead key sat on a screen looking exactly like a working one while a real hotel's channel
 * silently did nothing for hours. The only reason to save a key the provider rejects is a typo, and
 * the fix for a typo is to paste it again.
 *
 * ⚠️ **The one exception, and it is deliberate.** A key that Stripe never answered about — a timeout,
 * a rate limit, an outage on their side — is NOT refused, because refusing it would make our ability
 * to configure payments depend on Stripe being up at that moment. It is stored with
 * `lastCheckOk = null`, which the screen shows as *never tested* in amber, and the operator is told
 * in the same breath. Untested is an honest state; pretending we know is not.
 */
export async function saveStripeKey(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Sign in again to change a payment credential." };

  const mode = String(fd.get("mode") ?? "").trim();
  if (!isStripeMode(mode)) return { ok: false, error: "Choose sandbox or live." };

  const secret = String(fd.get("secretKey") ?? "");
  const checked = validateSecretKey(secret, mode);
  if (!checked.ok) return { ok: false, error: checked.error };

  const publishable = validatePublishableKey(String(fd.get("publishableKey") ?? ""), mode);
  if (!publishable.ok) return { ok: false, error: publishable.error };

  const webhook = validateWebhookSecret(String(fd.get("webhookSecret") ?? ""));
  if (!webhook.ok) return { ok: false, error: webhook.error };

  const key = secret.trim();
  const check = await checkStripeKey(key, mode);

  // Stripe answered and said no. That is a bad key, and a bad key is not stored.
  if (!check.ok && check.reachable && (check.status === 401 || check.status === 403 || check.modeMismatch)) {
    return { ok: false, error: check.message };
  }

  await prisma.platformCredential.upsert({
    where: { provider_mode: { provider: "stripe", mode } },
    update: {
      cipher: encryptSecret(key),
      hint: checked.hint,
      publishableKey: publishable.value || null,
      ...(webhook.value ? { webhookCipher: encryptSecret(webhook.value) } : {}),
      lastCheckedAt: check.reachable ? new Date() : null,
      lastCheckOk: check.reachable ? check.ok : null,
      lastCheckMessage: check.message.slice(0, 400),
      lastCheckDetail: check.account ? (check.account as unknown as object) : undefined,
      updatedBy: session.name,
    },
    create: {
      provider: "stripe",
      mode,
      cipher: encryptSecret(key),
      hint: checked.hint,
      publishableKey: publishable.value || null,
      ...(webhook.value ? { webhookCipher: encryptSecret(webhook.value) } : {}),
      lastCheckedAt: check.reachable ? new Date() : null,
      lastCheckOk: check.reachable ? check.ok : null,
      lastCheckMessage: check.message.slice(0, 400),
      lastCheckDetail: check.account ? (check.account as unknown as object) : undefined,
      updatedBy: session.name,
    },
  });

  revalidatePath("/integrations");
  revalidatePath("/integrations/stripe");

  if (!check.reachable) {
    return { ok: true, warning: `Saved, but not verified: ${check.message}` };
  }
  // Saved and working, yet not necessarily usable — Stripe's own verification may still be pending.
  return check.ok && check.account?.chargesEnabled === false
    ? { ok: true, warning: check.message }
    : { ok: true };
}

/** Exercise the STORED key without changing it. Drives "Check now". */
export async function testStripeConnection(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to check a connection.");

  const mode = String(fd.get("mode") ?? "").trim();
  if (!isStripeMode(mode)) return flashError("Reload the page and try again.");

  const storedKey = await readStripeSecret(mode);
  if (storedKey.state === "missing") return flashError("There is no Stripe key stored for this mode.");
  if (storedKey.state === "decryption_error") {
    return flashError("The stored key cannot be decrypted. CONNECTIVITY_SECRET may have changed — repair the rotation or replace the credential before using payments.");
  }

  const check = await checkStripeKey(storedKey.secret, mode);
  await prisma.platformCredential.update({
    where: { provider_mode: { provider: "stripe", mode } },
    data: {
      // An unreachable Stripe leaves the previous verdict alone rather than overwriting a known-good
      // result with a network problem. Only an actual answer changes what we believe about the key.
      ...(check.reachable
        ? { lastCheckedAt: new Date(), lastCheckOk: check.ok, lastCheckDetail: check.account ? (check.account as unknown as object) : undefined }
        : {}),
      lastCheckMessage: check.message.slice(0, 400),
    },
  });

  // Said out loud as well as recorded: pressing a button and watching a pill maybe change is not an
  // answer, and a pill cannot carry "connected to Уебър БГ ЕООД (BG, EUR)".
  await setFlash(check.ok ? "success" : "error", check.message);
  revalidatePath("/integrations");
  revalidatePath("/integrations/stripe");
}

/**
 * Remove a stored credential.
 *
 * Deleting rather than blanking, so nothing is left half-configured — and it is the only way to
 * revoke from here, since the key can never be read back out to be checked against Stripe's own
 * dashboard.
 */
export async function removeStripeKey(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to remove a payment credential.");
  const mode = String(fd.get("mode") ?? "").trim();
  if (!isStripeMode(mode)) return flashError("Reload the page and try again.");

  await prisma.platformCredential.deleteMany({ where: { provider: "stripe", mode } });
  await setFlash(
    "success",
    `The ${mode === "live" ? "live" : "sandbox"} Stripe key has been removed from Revio. Roll it in the Stripe dashboard too if it may have been seen.`,
  );
  revalidatePath("/integrations");
  revalidatePath("/integrations/stripe");
}

/**
 * Set which VAT registration we hold.
 *
 * Not cosmetic and not a preference: it changes the tax on every invoice issued afterwards. The
 * three states and what each does are documented on `decideVat` — the middle one, чл. 97а, is why
 * this is a choice of three and not a switch.
 *
 * Invoices already issued are untouched, deliberately. A document that has been sent is in somebody
 * else's accounting system; changing its tax retroactively is a credit note and a conversation, not
 * an `UPDATE`.
 */
export async function setVatRegistration(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change the VAT setting.");

  const value = String(fd.get("vatRegistration") ?? "").trim();
  if (!isVatRegistration(value)) return flashError("Pick one of the three registrations.");

  const company = await prisma.operatorCompany.findUnique({ where: { id: "singleton" }, select: { vatId: true } });
  if (value !== "none" && !company?.vatId) {
    return flashError("Add the company VAT number on this page first — an invoice claiming a registration has to print the number it was registered under.");
  }

  await prisma.operatorCompany.update({ where: { id: "singleton" }, data: { vatRegistration: value } });
  await setFlash(
    "success",
    value === "full"
      ? "Bulgarian customers will now be charged VAT on new invoices. Invoices already issued are unchanged."
      : value === "art97a"
        ? "New invoices to Bulgarian customers will carry no VAT, on the чл. 113, ал. 9 ground. EU business customers stay on reverse charge."
        : "New invoices will carry no VAT at all. Invoices already issued are unchanged.",
  );
  revalidatePath("/settings");
  revalidatePath("/integrations");
}

/**
 * Create the payment link for an issued invoice.
 *
 * ## Every refusal below is a bill that would otherwise be paid twice, or paid wrongly
 *
 * A draft has no number and no frozen amount — its price can still move — so a link against one
 * charges a figure nobody has agreed. An already-paid invoice does not need a second link. And a
 * live link is not regenerated: two live links for one invoice is two chances to pay the same bill,
 * and the refund conversation that follows costs more than the button saved.
 */
export async function createInvoicePaymentLink(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to create a payment link.");

  const invoiceId = String(fd.get("invoiceId") ?? "").trim();
  if (!invoiceId) return flashError("Reload the page and try again.");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return flashError("That invoice no longer exists.");
  if (!invoice.number) {
    return flashError("Issue this invoice first — a draft has no number and its amount can still change.");
  }
  if (invoice.status === "paid") return flashError("This invoice is already paid.");
  if (isLinkLive(invoice.stripeCheckoutExpires)) {
    return flashError("There is already a live payment link for this invoice. Two links means two chances to pay the same bill — send the existing one.");
  }

  const owed = invoice.grossMinor ?? invoice.amountMinor;
  const mode = await activeStripeMode();
  const storedKey = await readStripeSecret(mode);
  if (storedKey.state === "missing") return flashError(`No Stripe key is stored for ${mode} mode. Set it up on Integrations first.`);
  if (storedKey.state === "decryption_error") {
    return flashError("The stored Stripe key cannot be decrypted. Repair CONNECTIVITY_SECRET rotation or replace the credential before creating a payment link.");
  }

  const [tenant, billing] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: invoice.tenantId }, select: { name: true } }),
    prisma.clientBilling.findUnique({ where: { tenantId: invoice.tenantId }, select: { legalName: true, billingEmail: true } }),
  ]);

  /*
   * The origin comes from the request, not from a constant.
   *
   * Stripe sends the browser back here, and a hard-coded production URL would bounce anyone testing
   * on a preview deployment out to production halfway through a payment — which is exactly when a
   * surprise is least welcome.
   */
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "https://operator.reviosoft.app";

  const result = await createCheckoutSession({
    mode,
    secretKey: storedKey.secret,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    amountMinor: owed,
    currency: invoice.currency,
    customerName: billing?.legalName ?? tenant?.name ?? "Customer",
    customerEmail: billing?.billingEmail ?? null,
    origin,
    previousSessionId: invoice.stripeSessionId,
  });
  if (!result.ok) return flashError(result.error);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      stripeSessionId: result.session.sessionId,
      stripeCheckoutUrl: result.session.url,
      stripeCheckoutExpires: result.session.expiresAt,
      stripeMode: mode,
    },
  });

  await setFlash(
    mode === "live" ? "success" : "info",
    mode === "live"
      ? "Payment link created. Sending it will charge a real card."
      : "Payment link created in SANDBOX mode — it charges nothing. Use Stripe's test card 4242 4242 4242 4242.",
  );
  revalidatePath(`/invoice/${invoice.id}`);
  revalidatePath("/billing");
}

/**
 * Cancel a live link.
 *
 * Forgetting the URL is enough for our side, but Stripe's session stays open until it expires — so
 * the message says so rather than implying a certainty we do not have. Somebody holding the old URL
 * could still pay it, and the webhook would still settle the invoice correctly; what this stops is
 * us continuing to hand it out.
 */
export async function clearInvoicePaymentLink(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change a payment link.");
  const invoiceId = String(fd.get("invoiceId") ?? "").trim();
  if (!invoiceId) return flashError("Reload the page and try again.");

  await prisma.invoice.updateMany({
    where: { id: invoiceId, status: { not: "paid" } },
    data: { stripeCheckoutUrl: null, stripeCheckoutExpires: null },
  });
  await setFlash("success", "Link withdrawn here. Anyone still holding the URL can use it until Stripe expires it, and a payment would still be recorded correctly.");
  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath("/billing");
}

/**
 * Choose which Stripe environment payments use.
 *
 * ## Going live has a precondition, and it is not the same as inferring
 *
 * Live is refused unless a live key is stored **and has been tested successfully**. That is not the
 * defect this replaced: the old code read the presence of a tested key as the decision, whereas this
 * reads a person's decision and merely refuses to pretend it can be honoured. The difference is that
 * pasting a key here changes nothing at all until somebody says so.
 *
 * Switching back to sandbox has no precondition. Stopping charging real cards is never the dangerous
 * direction, and a gate on it would be a gate on the panic button.
 */
export async function setStripeMode(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to change the payment environment.");
  if (session.role !== "super_admin") {
    // Deliberately narrower than most settings: this one decides whether real money moves.
    return flashError("Only a super admin can switch the payment environment.");
  }

  const mode = String(fd.get("mode") ?? "").trim();
  if (!isStripeMode(mode)) return flashError("Reload the page and try again.");

  if (mode === "live") {
    const cred = await prisma.platformCredential.findUnique({
      where: { provider_mode: { provider: "stripe", mode: "live" } },
      select: { lastCheckOk: true, lastCheckDetail: true },
    });
    if (!cred) {
      return flashError("Add the live keys first. Going live with nothing stored would leave every payment link broken.");
    }
    if (cred.lastCheckOk !== true) {
      return flashError("The live key has not been checked successfully. Press Check now on the live panel first — going live on an untested key is how a customer finds the problem for you.");
    }
    const detail = cred.lastCheckDetail as { chargesEnabled?: boolean } | null;
    if (detail?.chargesEnabled !== true) {
      return flashError("Stripe has not confirmed that this live account can accept charges. Finish account verification and press Check now before going live.");
    }
    const [apiKey, webhook] = await Promise.all([
      readStripeSecret("live"),
      readStripeWebhookSecret("live"),
    ]);
    if (apiKey.state !== "ready") {
      return flashError(apiKey.state === "decryption_error"
        ? "The live API key cannot be decrypted. Repair CONNECTIVITY_SECRET rotation or replace it before going live."
        : "The live API key is missing.");
    }
    if (webhook.state !== "ready") {
      return flashError(webhook.state === "decryption_error"
        ? "The live webhook secret cannot be decrypted. Genuine payments could not settle invoices in Revio."
        : "Add the live webhook signing secret before going live. Without it, Stripe can charge a card but Revio cannot verify the payment.");
    }
  }

  await prisma.operatorCompany.update({ where: { id: "singleton" }, data: { stripeMode: mode } });
  await setFlash(
    mode === "live" ? "error" : "success",
    mode === "live"
      ? "Payments are now LIVE. Every payment link created from here on charges a real card."
      : "Payments are back in sandbox. Nothing created from here on can charge anybody.",
  );
  revalidatePath("/integrations");
  revalidatePath("/integrations/stripe");
}
