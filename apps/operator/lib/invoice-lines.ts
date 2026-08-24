import { priceBreakdown, type Entitlements } from "./pricing";
import { type VatDecision } from "./vat";

/**
 * The parts of an invoice that are pure arithmetic and formatting.
 *
 * Separated from `invoice-doc.ts` for one reason: that module is `server-only` and holds a Prisma
 * client, so nothing in it can be unit tested without a database. These functions decide what a
 * customer's finance team actually reads, and the invariant below — that the lines add up to the
 * price we quote everywhere else — is exactly the kind of thing that should be proven rather than
 * eyeballed on a rendered page.
 */

/** One line as it will be printed, and kept, on the invoice. */
export interface InvoiceLine {
  description: string;
  netMinor: number;
}

/**
 * The billed lines, derived from the same price breakdown the billing screen shows.
 *
 * Written out per component rather than as one "monthly subscription" line because a customer's
 * finance team reconciles an invoice against what they think they bought. "Platform + RevioLink +
 * RevioCRS, less a bundle discount" is checkable; a single number is a thing to query by email.
 */
export function invoiceLines(plan: string, ent: Entitlements): InvoiceLine[] {
  const b = priceBreakdown(plan, ent);
  const lines: InvoiceLine[] = [];
  if (b.platformMinor > 0) lines.push({ description: `Platform fee — ${plan}`, netMinor: b.platformMinor });
  for (const m of b.modules) lines.push({ description: m.label, netMinor: m.minor });
  if (b.discountMinor > 0) {
    lines.push({ description: `Bundle discount — ${b.discountPct}%`, netMinor: -b.discountMinor });
  }
  return lines.filter((l) => l.netMinor !== 0);
}

/** One address string from its parts, skipping whatever is missing. */
export function formatAddress(a: {
  addressLine?: string | null; city?: string | null; postCode?: string | null; country?: string | null;
}): string | null {
  const parts = [a.addressLine, [a.postCode, a.city].filter(Boolean).join(" "), a.country]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.length ? parts.join(", ") : null;
}

/** What the VAT line should say on screen, given a decision. */
export function vatLabel(d: Pick<VatDecision, "treatment" | "ratePct">): string {
  if (d.treatment === "eu_reverse_charge") return "VAT — reverse charge (0%)";
  if (d.treatment === "outside_eu") return "VAT — outside scope (0%)";
  if (d.treatment === "not_registered") return "VAT — not registered (0%)";
  return `VAT ${d.ratePct}%`;
}

/**
 * Format a number the way Bulgarian law requires: ten digits, Arabic numerals, nothing else.
 *
 * ЗДДС чл. 114, ал. 1, т. 2 — "пореден десетразряден номер, съдържащ само арабски цифри". No prefix,
 * no year, no separator. The first version of this shipped as `REV-2026-0001` and was wrong on all
 * three counts, plus it restarted each January, which produces a duplicate in year two.
 */
export function formatInvoiceNumber(n: bigint): string {
  return n.toString().padStart(10, "0");
}

/**
 * A demo number, deliberately NOT a valid one.
 *
 * Demo tenants are billed like real clients so the flow stays testable end to end, and their
 * documents must be impossible to mistake for tax documents. A second ten-digit range would be
 * numerically tidy and visually identical to the real thing; a letter prefix is illegal on a
 * Bulgarian invoice, which is exactly what makes it safe here.
 */
export function formatDemoNumber(n: bigint): string {
  return `DEMO-${n.toString().padStart(6, "0")}`;
}

/**
 * Which rendering of our own identity belongs on this invoice.
 *
 * "Уебър БГ ЕООД" and "WEBER BG EOOD" are both official names for the same registered entity. The
 * choice is about the reader, not about correctness: a Bulgarian customer's accountant reconciles
 * against the commercial register and expects Cyrillic; a customer elsewhere receives a document
 * they cannot read, cannot check, and in some finance departments cannot file.
 *
 * Name and address are chosen **together**. Picking them independently produces "WEBER BG EOOD" above
 * "ул. Преслав 6, Русе", which reads as two different companies — exactly the doubt an invoice exists
 * to remove.
 *
 * Falls back to the primary rendering whenever the Latin one is absent, so a company that has only
 * one name is never left with a blank issuer.
 */
export interface BilingualIdentity {
  legalName: string;
  legalNameLatin?: string | null;
  addressLine?: string | null;
  addressLineLatin?: string | null;
  city?: string | null;
  cityLatin?: string | null;
  postCode?: string | null;
  country?: string | null;
}

export interface ChosenIdentity {
  legalName: string;
  addressLine: string | null;
  city: string | null;
  /** Which rendering was used — recorded so a reissued document cannot silently switch scripts. */
  script: "cyrillic" | "latin";
}

export function chooseIdentity(company: BilingualIdentity, buyerCountry: string | null | undefined): ChosenIdentity {
  const home = (company.country ?? "BG").trim().toUpperCase();
  const buyer = (buyerCountry ?? "").trim().toUpperCase();
  // No country on the buyer means we cannot say they read Cyrillic, so use the international
  // rendering when we have one. Guessing "domestic" would hand a foreign customer a document in a
  // script they cannot read, which is the worse of the two failures.
  const useLatin = buyer !== home && !!company.legalNameLatin?.trim();

  if (!useLatin) {
    return {
      legalName: company.legalName,
      addressLine: company.addressLine ?? null,
      city: company.city ?? null,
      script: "cyrillic",
    };
  }
  return {
    legalName: company.legalNameLatin!.trim(),
    // Each part falls back independently: a Latin name with only a Cyrillic street is still better
    // than a blank address, and the post code and country are script-neutral either way.
    addressLine: company.addressLineLatin?.trim() || company.addressLine || null,
    city: company.cityLatin?.trim() || company.city || null,
    script: "latin",
  };
}
