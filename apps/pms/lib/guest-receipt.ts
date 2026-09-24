import "server-only";
import { sendTemplatedEmail } from "@revio/email";
import { bookingReference, type EmailDetail } from "@revio/core";
import { prisma } from "./db";
import { folioBalance } from "./folio";
import { translate } from "@revio/ui/i18n";
import { folio as folioDict } from "./i18n/folio";

export type ReceiptOutcome = "sent" | "switched-off" | "no-address" | "failed";

const PAYMENT_KINDS = new Set(["payment", "deposit_held", "deposit_refund", "deposit_use"]);

const WORDS = {
  en: { reference: "Reference", stay: "Stay", total: "Total", paid: "Paid", due: "Still to pay" },
  bg: { reference: "Номер", stay: "Престой", total: "Общо", paid: "Платено", due: "Остава за плащане" },
} as const;

/**
 * The guest's bill, emailed at check-out (template `folio_receipt`), in the hotel's wording and
 * language — every charge on every folio of the stay, then what was paid and anything still owed.
 *
 * It is a statement of the bill, not a tax invoice: the invoice is a legal document issued from the
 * folio screen and stays in its own form. Never throws and never blocks the check-out, which has
 * already happened by the time this runs.
 */
export async function emailReceipt(reservationId: string): Promise<ReceiptOutcome> {
  try {
    const r = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, property: true, lines: true, folios: { include: { lines: true } } },
    });
    if (!r) return "failed";
    const to = r.guest?.email?.trim();
    if (!to) return "no-address";

    const locale = r.property.defaultLanguage === "bg" ? "bg" : "en";
    const W = WORDS[locale];
    const intl = locale === "bg" ? "bg-BG" : "en-GB";
    const currency = r.folios[0]?.currency ?? r.currency;
    const money = (minor: number) => new Intl.NumberFormat(intl, { style: "currency", currency }).format(minor / 100);
    const day = (d: Date) => d.toLocaleDateString(intl, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

    // System-written lines ("City tax") in the email's language, as the folio screen shows them.
    const system = translate(folioDict, locale).systemText;
    const lines = r.folios.flatMap((f) => f.lines).filter((l) => !l.voided);
    const totals = folioBalance(lines);
    const reference = bookingReference(r.id);
    const first = r.lines[0];
    const details: EmailDetail[] = [
      { label: W.reference, value: reference },
      ...(first ? [{ label: W.stay, value: `${day(first.checkIn)} – ${day(first.checkOut)}` }] : []),
      ...lines.filter((l) => !PAYMENT_KINDS.has(l.kind)).map((l) => ({ label: system[l.description] ?? l.description, value: money(l.amountMinor) })),
      { label: W.total, value: money(totals.charges), emphasis: true },
      { label: W.paid, value: money(totals.payments) },
      ...(totals.balance !== 0 ? [{ label: W.due, value: money(totals.balance), emphasis: true }] : []),
    ];

    const res = await sendTemplatedEmail(prisma, {
      propertyId: r.propertyId,
      key: "folio_receipt",
      to: [to],
      locale,
      vars: { guestName: r.guest?.firstName || r.guestName, propertyName: r.property.name, reference, total: money(totals.charges) },
      details,
    });
    if (res.skipped) return "switched-off";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
