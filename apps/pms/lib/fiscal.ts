import "server-only";

/**
 * The fiscalization / e-invoicing boundary (spec §4.7) — the THIRD integration boundary, alongside the
 * payment gateway (§4.5) and the channel adapter. Tax-authority compliance is per-country, legally
 * mandatory, and changing fast; the PMS must NEVER reimplement a country's tax protocol. It routes
 * through a certified provider, gated by the property's jurisdiction pack, and keeps the invoice /
 * receipt core generic. Two distinct obligations, not the same thing:
 *
 *  - Fiscalization (§4.7): consumer sales reported to the tax authority in real time via a certified
 *    fiscal device / SUPTO-certified POS, which returns a unique fiscal number/seal for the receipt.
 *    Bulgaria's Ordinance N-18 requires this today — a launch blocker for a real BG property.
 *  - Structured e-invoicing: B2B invoices in a structured format (EN 16931 via Peppol / a national
 *    platform). Mostly future in the EU; design the seam now, flip it on per market.
 *
 * MOCK-FIRST: with fiscalization off (default) this is a no-op. With it on, we return a MOCK fiscal
 * seal — a real deployment swaps this call for the certified provider's API; nothing else changes.
 */

export type FiscalConfig = { jurisdiction: string; fiscalizationEnabled: boolean; eInvoicingEnabled: boolean };
export type FiscalResult = { fiscalRef: string; mode: "mock" | "provider"; note: string } | null;

/** Fiscalize an issued document. Returns the fiscal reference to stamp on it, or null when the
 * property's jurisdiction pack doesn't require (or hasn't enabled) real-time fiscalization. */
export async function fiscalizeInvoice(cfg: FiscalConfig, doc: { docType: string; number: string; grossMinor: number; currency: string }): Promise<FiscalResult> {
  if (!cfg.fiscalizationEnabled) return null;

  // A certified fiscal provider (e.g. a SUPTO-certified POS in Bulgaria) is where the real API call
  // goes. Here we mint a mock seal deterministically so the demo shows the end-to-end path.
  const authority = cfg.jurisdiction === "bg" ? "NRA" : "TAX";
  const seal = mockSeal(`${doc.docType}:${doc.number}:${doc.grossMinor}`);
  const channel = cfg.eInvoicingEnabled ? "fiscal+e-invoice (EN 16931)" : "fiscal receipt";
  return {
    fiscalRef: `${authority}-${seal}`,
    mode: "mock",
    note: `Reported to ${authority} via a certified provider (${channel}) — mock; a real BG N-18 deployment swaps in the provider API.`,
  };
}

/** A short, stable pseudo-seal for the demo (NOT a real fiscal signature). */
function mockSeal(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().padStart(8, "0").slice(0, 8);
}
