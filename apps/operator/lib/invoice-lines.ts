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
