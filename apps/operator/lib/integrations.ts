/**
 * Every connection this platform depends on, in one list.
 *
 * ## Why a centre now, when one integration did not justify one
 *
 * It was declined on 2026-09-08 with one integration, because a centre holding a single row is a
 * folder, not a feature. There are now four things that can independently be misconfigured and each
 * used to be discovered separately, usually by the thing it powers quietly not working:
 *
 *   | | Where it used to be checked |
 *   | --- | --- |
 *   | Stripe (ours) | nowhere — it did not exist |
 *   | Channex | `/connectivity`, per hotel |
 *   | Outbound email | nowhere; a missing key silently logged instead of sending |
 *   | Support mailbox | nowhere; the job ran and found nothing, which looks identical to no mail |
 *
 * Three of those four fail **silently and look like calm**, which is the specific failure this
 * screen exists to end. Adding the fifth should be a row here, not a project.
 *
 * ## The one rule the rows obey
 *
 * **Never tested is not the same as working, and neither is configured.** `ConnectivityCredential`
 * learned this the hard way on 2026-09-01, when a revoked key sat on a screen looking healthy while
 * a real hotel's channel did nothing for hours. So `state` has four values and the screen colours
 * them differently — a key nobody has exercised is amber, never green.
 */

import { forSystem, decryptSecret } from "@revio/db";
import { vatThresholdStatus, type ThresholdStatus } from "./vat-threshold";
import { registrationOf, type VatRegistration } from "./vat";
import type { StripeMode } from "./stripe-key";
import type { StripeAccountInfo } from "./stripe-check";

const prisma = forSystem();

export type IntegrationState =
  /** Configured and last exercised successfully. The only green. */
  | "working"
  /** Configured, and the provider said no. */
  | "rejected"
  /** Configured and never exercised. NOT the same as working — see the note above. */
  | "untested"
  /** Nothing set. Often the correct state, so it must not read as a fault. */
  | "not_configured"
  /** Set somewhere this service cannot read — true of the Channex keys, which live on other apps. */
  | "elsewhere";

export interface IntegrationRow {
  key: string;
  name: string;
  /** What it does, in the words of somebody who has to decide whether it matters. */
  purpose: string;
  state: IntegrationState;
  /** "test" / "live" / "production" — whatever the provider's own word is. Null when it has none. */
  mode: string | null;
  /** Safe to display: never the secret, only enough to recognise which one is installed. */
  hint: string | null;
  lastCheckedAt: Date | null;
  lastCheckMessage: string | null;
  /** Where to go to do something about it. */
  href: string | null;
  /** True when this row is ours to fix here, rather than a link to somewhere else. */
  managedHere: boolean;
}

export interface StripeConnection {
  mode: StripeMode;
  configured: boolean;
  hint: string | null;
  publishableKey: string | null;
  hasWebhookSecret: boolean;
  lastCheckedAt: Date | null;
  lastCheckOk: boolean | null;
  lastCheckMessage: string | null;
  account: StripeAccountInfo | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

function stateOf(cred: { lastCheckOk: boolean | null } | null): IntegrationState {
  if (!cred) return "not_configured";
  if (cred.lastCheckOk === null) return "untested";
  return cred.lastCheckOk ? "working" : "rejected";
}

/** One Stripe mode's stored connection, with the secret deliberately never in the return type. */
export async function getStripeConnection(mode: StripeMode): Promise<StripeConnection> {
  const cred = await prisma.platformCredential.findUnique({
    where: { provider_mode: { provider: "stripe", mode } },
  });
  return {
    mode,
    configured: !!cred,
    hint: cred?.hint ?? null,
    publishableKey: cred?.publishableKey ?? null,
    hasWebhookSecret: !!cred?.webhookCipher,
    lastCheckedAt: cred?.lastCheckedAt ?? null,
    lastCheckOk: cred?.lastCheckOk ?? null,
    lastCheckMessage: cred?.lastCheckMessage ?? null,
    account: (cred?.lastCheckDetail as StripeAccountInfo | null) ?? null,
    updatedBy: cred?.updatedBy ?? null,
    updatedAt: cred?.updatedAt ?? null,
  };
}

/**
 * The secret itself, for the one caller that has to send it to Stripe.
 *
 * Separate from `getStripeConnection` on purpose: everything that renders a screen uses that one and
 * *cannot* leak a key, because the key is not in the type. This is the narrow door, it is called
 * from server actions only, and what it returns is never returned onward to a component.
 */
export async function readStripeSecret(mode: StripeMode): Promise<string | null> {
  const cred = await prisma.platformCredential.findUnique({
    where: { provider_mode: { provider: "stripe", mode } },
    select: { cipher: true },
  });
  if (!cred) return null;
  try {
    return decryptSecret(cred.cipher);
  } catch {
    // A key we cannot decrypt is as unusable as one Stripe rejects, and the two need different
    // repairs — CONNECTIVITY_SECRET having changed is a rotation problem, not a credential problem.
    return null;
  }
}

/**
 * Which Stripe environment payments actually use.
 *
 * ⚠️ **Read from a stored choice, never derived from what happens to be configured.**
 *
 * This used to be `live?.lastCheckOk === true ? "live" : "test"` — so the ordinary act of pasting a
 * live key to check the connection worked silently made the next payment link charge a real card.
 * `validateSecretKey` refuses a live key in a sandbox field for exactly that reason; the selection
 * one layer up then inferred the same thing from the same evidence.
 *
 * A missing company row means nothing has been configured at all, and the safe reading of that is
 * sandbox — never the environment that moves money.
 */
export async function activeStripeMode(): Promise<StripeMode> {
  const company = await prisma.operatorCompany.findUnique({
    where: { id: "singleton" },
    select: { stripeMode: true },
  });
  return company?.stripeMode === "live" ? "live" : "test";
}

/**
 * Whether the chosen mode can actually be honoured, and what to say when it cannot.
 *
 * The choice and the credential are separate facts and either can move without the other — somebody
 * removes a key, a key gets rolled at Stripe, a rotation loses a secret. A console set to live with
 * no working live key looks entirely normal and takes no money, so the mismatch is surfaced rather
 * than discovered by an invoice nobody could pay.
 */
export async function stripeModeStatus(): Promise<{
  mode: StripeMode;
  usable: boolean;
  problem: string | null;
}> {
  const mode = await activeStripeMode();
  const cred = await prisma.platformCredential.findUnique({
    where: { provider_mode: { provider: "stripe", mode } },
    select: { lastCheckOk: true },
  });
  if (!cred) {
    return { mode, usable: false, problem: `Payments are set to ${mode === "live" ? "LIVE" : "sandbox"}, but no ${mode} key is stored. Nothing can be charged.` };
  }
  if (cred.lastCheckOk === false) {
    return { mode, usable: false, problem: `The stored ${mode} key was rejected by Stripe the last time it was checked. Payment links will fail until it is replaced.` };
  }
  if (cred.lastCheckOk === null) {
    return { mode, usable: true, problem: `The ${mode} key has never been tested. Press Check now before relying on it — a key nobody has exercised is not a working key.` };
  }
  return { mode, usable: true, problem: null };
}

export async function getIntegrations(): Promise<IntegrationRow[]> {
  const creds = await prisma.platformCredential.findMany({ where: { provider: "stripe" } });
  const byMode = new Map(creds.map((c) => [c.mode, c]));
  const live = byMode.get("live") ?? null;
  const test = byMode.get("test") ?? null;
  // Live is the one that matters once it exists; until then the sandbox is the real answer.
  const stripe = live ?? test;

  const rows: IntegrationRow[] = [
    {
      key: "stripe",
      name: "Stripe",
      purpose: "Collects subscription payments from hotels, so an invoice can be paid by card instead of chased by bank transfer.",
      state: stateOf(stripe),
      mode: stripe ? (stripe.mode === "live" ? "live" : "sandbox") : null,
      hint: stripe?.hint ?? null,
      lastCheckedAt: stripe?.lastCheckedAt ?? null,
      lastCheckMessage: stripe?.lastCheckMessage ?? null,
      href: "/integrations/stripe",
      managedHere: true,
    },
    {
      key: "channex",
      name: "Channex",
      purpose: "Pushes availability and rates to the OTAs and pulls their bookings back. The channel manager is built on it.",
      /*
       * Honest rather than convenient. The Channex keys live on channel-manager, reservation and pms
       * — this service cannot read another service's environment, so reporting "not configured" here
       * would be a lie that reads as an outage. `elsewhere` says where to look instead.
       */
      state: "elsewhere",
      mode: "production",
      hint: null,
      lastCheckedAt: null,
      lastCheckMessage: "Set per service in Railway, and tested from Connectivity — this console cannot read another service's environment.",
      href: "/connectivity",
      managedHere: false,
    },
    {
      key: "email",
      name: "Outbound email (Resend)",
      purpose: "Every message the platform sends — booking confirmations, invitations, password resets, support replies.",
      /*
       * ⚠️ Without a key the mailer does not fail, it LOGS. That is the right behaviour (a mail
       * provider outage must not break a booking) and it is exactly why this row exists: nothing
       * anywhere else distinguishes "sent" from "written to a log nobody reads".
       */
      state: process.env.RESEND_API_KEY ? "working" : "not_configured",
      mode: null,
      hint: null,
      lastCheckedAt: null,
      lastCheckMessage: process.env.RESEND_API_KEY
        ? "A key is set on this service. Messages are delivered."
        : "No RESEND_API_KEY on this service — mail is written to the log instead of sent, and nothing reports it as a failure.",
      href: null,
      managedHere: false,
    },
    {
      key: "support-mailbox",
      name: "Support mailbox",
      purpose: "Reads support@reviosoft.app so a hotel that presses reply lands back in its ticket instead of into a void.",
      state: process.env.SUPPORT_IMAP_HOST && process.env.SUPPORT_IMAP_PASSWORD ? "working" : "not_configured",
      mode: null,
      hint: process.env.SUPPORT_IMAP_USER ?? null,
      lastCheckedAt: null,
      lastCheckMessage:
        process.env.SUPPORT_IMAP_HOST && process.env.SUPPORT_IMAP_PASSWORD
          ? "Read-only IMAP. Nothing in the mailbox is marked, moved or deleted."
          : "SUPPORT_IMAP_* is not set on this service — replies to our support email are not being read.",
      href: "/support",
      managedHere: false,
    },
  ];
  return rows;
}

export interface VatPosition {
  registration: VatRegistration;
  vatId: string | null;
  country: string;
  standardVatPct: number;
  threshold: ThresholdStatus;
}

/**
 * Where we stand on VAT: which registration we hold, and how close the calendar year is to forcing
 * the next one.
 *
 * Joins each invoice to the customer's country rather than reading the treatment recorded on it —
 * see the note in `vat-threshold.ts`. Under a `none` registration every treatment reads
 * `not_registered` whoever bought, so the treatment cannot answer "was this domestic", and `none` is
 * the state in which the answer matters most.
 */
export async function getVatPosition(now = new Date()): Promise<VatPosition | null> {
  const company = await prisma.operatorCompany.findUnique({ where: { id: "singleton" } });
  if (!company) return null;

  const invoices = await prisma.invoice.findMany({
    select: { issuedAt: true, netMinor: true, amountMinor: true, tenantId: true },
  });
  const tenantIds = [...new Set(invoices.map((i) => i.tenantId))];
  const [billings, tenants] = await Promise.all([
    prisma.clientBilling.findMany({ where: { tenantId: { in: tenantIds } }, select: { tenantId: true, country: true } }),
    prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, isDemo: true } }),
  ]);
  const countryOf = new Map(billings.map((b) => [b.tenantId, b.country]));
  const demoOf = new Map(tenants.map((t) => [t.id, t.isDemo]));

  const threshold = vatThresholdStatus(
    invoices.map((i) => ({
      issuedAt: i.issuedAt,
      netMinor: i.netMinor,
      amountMinor: i.amountMinor,
      buyerCountry: countryOf.get(i.tenantId) ?? null,
      isDemo: demoOf.get(i.tenantId) ?? false,
    })),
    company.country,
    now.getUTCFullYear(),
  );

  return {
    registration: registrationOf(company),
    vatId: company.vatId,
    country: company.country,
    standardVatPct: company.standardVatPct,
    threshold,
  };
}
