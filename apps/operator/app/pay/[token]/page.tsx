import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, CreditCard, Download, Landmark } from "lucide-react";
import { forSystem } from "@revio/db";
import { docMoney } from "@/lib/invoice-html";
import { invoiceByPayToken, PAY_WORDS } from "@/lib/pay-page";
import { activeStripeMode, readStripeSecret } from "@/lib/integrations";
import { epcPayload } from "@/lib/epc-qr";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/**
 * An invoice's own page — the link in every invoice email and reminder.
 *
 * The shape every serious billing system converged on (Stripe's hosted invoice page, Paddle,
 * Chargebee): one page per invoice that never expires, showing what is owed and when, with the card
 * button, the bank route and the document side by side. A Stripe Checkout link dies after 24 hours;
 * a link in a finance inbox is opened days later, so the email points here and this page makes a
 * fresh Checkout session each time the button is pressed.
 *
 * ## What it shows, and why that is safe
 *
 * The invoice's own facts — the same ones already in the customer's email and attachment — and our
 * bank details, which are printed on every invoice we send. Nothing about any other invoice or any
 * other client. It is reached only by a 24-byte random token (`invoiceByPayToken`), and an unknown
 * token is the ordinary 404, so the page cannot be used to learn whether an invoice exists.
 *
 * It decides nothing: a return from Stripe (`?paid=1`) says "being confirmed" until the webhook has
 * actually settled the invoice — a redirect is not evidence of payment.
 */
/** The tab reads as the invoice, not as our admin console — this page is the customer's, not ours. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const invoice = await invoiceByPayToken((await params).token);
  if (!invoice) return { robots: { index: false } };
  const w = PAY_WORDS[invoice.language === "en" ? "en" : "bg"];
  return { title: `${w.title(invoice.number!)} · ${invoice.issuerName ?? "Revio"}`, robots: { index: false } };
}

export default async function PayPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const invoice = await invoiceByPayToken(token);
  if (!invoice) notFound();

  const company = await forSystem().operatorCompany.findUnique({ where: { id: "singleton" } });
  const lang = invoice.language === "en" ? "en" : "bg";
  const w = PAY_WORDS[lang];
  const owed = invoice.grossMinor ?? invoice.amountMinor;
  const day = (d: Date) => d.toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  const paid = invoice.status === "paid";
  const overdue = !paid && invoice.dueDate && invoice.dueDate.getTime() < Date.now();
  const mode = await activeStripeMode();
  const live = mode === "live";
  // The card button only when a key for the active mode is stored — otherwise the bank route alone,
  // said plainly, rather than a button that bounces.
  const cardReady = (await readStripeSecret(mode)).state === "ready";
  // The bank route as a QR the customer's banking app can read — only when every field is right.
  const iban = invoice.issuerIban ?? company?.iban ?? null;
  const epc = !paid && iban
    ? // SEPA's character set is Latin: the registered Latin name where we have one, so a bank does not reject it.
    epcPayload({ name: company?.legalNameLatin || invoice.issuerName || company?.legalName || "", iban, bic: invoice.issuerBic ?? company?.bic, amountMinor: owed, currency: invoice.currency, reference: invoice.number! })
    : null;
  const qr = epc ? await QRCode.toDataURL(epc, { errorCorrectionLevel: "M", margin: 1, width: 360 }) : null;

  return (
    <main lang={lang} className="min-h-screen bg-[#f4f5f7] px-4 py-10 text-[#1c2434]">
      <div className="mx-auto w-full max-w-[34rem]">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">{invoice.issuerName}</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight">{w.title(invoice.number!)}</h1>

        <section className="mt-5 rounded-xl border border-[#e4e7ec] bg-white p-6">
          <p className="text-[12.5px] font-semibold text-[#6b7486]">{paid ? w.paidTotal : w.due}</p>
          <p className="mt-1 text-[34px] font-extrabold tabular-nums tracking-tight">{docMoney(owed, invoice.currency, lang)}</p>
          {paid ? (
            <p className="mt-2 flex items-center gap-1.5 text-[14px] font-semibold text-[#1f7a4d]">
              <CheckCircle2 size={16} aria-hidden /> {w.paid} {invoice.paidAt ? w.paidOn(day(invoice.paidAt)) : ""}
            </p>
          ) : sp.paid ? (
            <p className="mt-2 text-[14px] font-semibold text-[#1f6fd1]">{w.returned}</p>
          ) : invoice.dueDate ? (
            <p className={`mt-2 text-[13.5px] font-semibold ${overdue ? "text-[#b53528]" : "text-[#6b7486]"}`}>
              {overdue ? w.overdue(day(invoice.dueDate)) : w.dueOn(day(invoice.dueDate))}
            </p>
          ) : null}

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-[#eef0f3] pt-4 text-[13px]">
            <dt className="text-[#8a94a6]">{w.to}</dt><dd className="font-semibold">{invoice.buyerName}</dd>
            <dt className="text-[#8a94a6]">{w.from}</dt><dd>{invoice.issuerName}</dd>
          </dl>

          {!paid && !sp.paid && (
            <div className="mt-5">
              {cardReady ? (
                <a
                  href={`/pay/${token}/card`}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0e203c] text-[15px] font-semibold text-white hover:bg-[#1b3358]"
                >
                  <CreditCard size={17} aria-hidden /> {w.card}
                </a>
              ) : null}
              <p className="mt-2 text-center text-[12px] text-[#8a94a6]">
                {cardReady ? <>{w.cardNote}{!live ? ` ${w.testNote}` : ""}</> : w.noCard}
              </p>
            </div>
          )}
        </section>

        {!paid && (invoice.issuerIban ?? company?.iban) && (
          <section className="mt-4 rounded-xl border border-[#e4e7ec] bg-white p-6">
            <h2 className="flex items-center gap-2 text-[14px] font-bold"><Landmark size={16} aria-hidden /> {cardReady ? w.bank : w.bankOnly}</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {(invoice.issuerBankName ?? company?.bankName) && (<><dt className="text-[#8a94a6]">{w.bankName}</dt><dd>{invoice.issuerBankName ?? company?.bankName}</dd></>)}
              <dt className="text-[#8a94a6]">IBAN</dt><dd className="select-all font-mono">{invoice.issuerIban ?? company?.iban}</dd>
              {(invoice.issuerBic ?? company?.bic) && (<><dt className="text-[#8a94a6]">BIC</dt><dd className="font-mono">{invoice.issuerBic ?? company?.bic}</dd></>)}
              <dt className="text-[#8a94a6]">{w.reference}</dt><dd className="select-all font-mono">{invoice.number}</dd>
            </dl>
            {qr && (
              <div className="mt-4 flex items-center gap-4 border-t border-[#eef0f3] pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- a data URL drawn on the server */}
                <img src={qr} alt="" width={120} height={120} className="h-[120px] w-[120px] shrink-0 rounded border border-[#e4e7ec]" />
                <p className="text-[12.5px] leading-relaxed text-[#6b7486]">{w.qr}</p>
              </div>
            )}
          </section>
        )}

        <a href={`/pay/${token}/invoice`} className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#e4e7ec] bg-white px-4 py-3 text-[14px] font-semibold text-[#1f6fd1] hover:bg-[#f7f8fa]">
          <Download size={16} aria-hidden /> {w.download}
        </a>

        {company?.email && <p className="mt-6 text-center text-[12.5px] text-[#8a94a6]">{w.questions(company.email)}</p>}
      </div>
    </main>
  );
}
