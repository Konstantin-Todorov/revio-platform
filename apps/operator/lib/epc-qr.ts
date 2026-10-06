/**
 * The bank-transfer QR code on an invoice's page — the European Payments Council's "SEPA Credit
 * Transfer" QR (EPC069-12, version 002). A banking app that reads it fills in the beneficiary, IBAN,
 * amount and reference itself, so the customer types nothing and cannot mistype the reference that
 * matches the money to the invoice.
 *
 * Pure: it builds the text, `qrcode` draws it. Returns null whenever the code would be wrong rather
 * than incomplete — a QR that pre-fills a wrong amount is worse than none:
 *  - the standard is euro-only;
 *  - the amount must be 0.01 – 999 999 999.99;
 *  - the beneficiary name is required and capped at 70 characters, the reference at 140.
 */
export function epcPayload(p: { name: string; iban: string; bic?: string | null; amountMinor: number; currency: string; reference: string }): string | null {
  if (p.currency.toUpperCase() !== "EUR") return null;
  if (!Number.isInteger(p.amountMinor) || p.amountMinor < 1 || p.amountMinor > 99_999_999_999) return null;
  const iban = p.iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return null;
  const name = p.name.trim().slice(0, 70);
  if (!name) return null;
  const bic = (p.bic ?? "").replace(/\s+/g, "").toUpperCase();
  const amount = `EUR${Math.floor(p.amountMinor / 100)}.${String(p.amountMinor % 100).padStart(2, "0")}`;
  return [
    "BCD", "002", "1", "SCT",
    /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic) ? bic : "",
    name, iban, amount,
    "", // purpose code
    "", // structured reference — we use the free-text one, which carries the invoice number as printed
    p.reference.trim().slice(0, 140),
  ].join("\n");
}
