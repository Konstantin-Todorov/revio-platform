"use server";

import { revalidatePath } from "next/cache";
import { forSystem, encryptSecret } from "@revio/db";
import { flashError, setFlash } from "@revio/ui/flash";
import { getOperatorSession } from "./session";
import { checkStripeKey } from "./stripe-check";
import { readStripeSecret } from "./integrations";
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

  const key = await readStripeSecret(mode);
  if (!key) {
    return flashError(
      "There is no usable key stored for this mode. If one was saved, CONNECTIVITY_SECRET may have changed since — see DEPLOY.md, key rotation.",
    );
  }

  const check = await checkStripeKey(key, mode);
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
