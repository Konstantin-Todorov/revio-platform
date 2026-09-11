import { renderSystemEmail, renderSystemEmailText, type SystemEmailArgs, type SystemEmailBlock } from "@revio/core";

/**
 * The two letters that carry an invoice: "here is what you owe" and "we have it".
 *
 * ## Why these are pure builders
 *
 * Everything here is a decision about what a customer reads when we ask them for money, and every
 * one of those decisions is arguable — so they are made in one testable place rather than inline in
 * a server action where the only way to see them is to send yourself an email.
 *
 * ## The rules they follow
 *
 * **The amount and the invoice number are in the subject line.** Half the recipients decide whether
 * to open it from the subject alone, and "Invoice from Revio" tells them nothing they need.
 *
 * **A card link is offered, never imposed.** Bank transfer stays in the letter with the IBAN,
 * because a hotel's finance person may have no card authority at all, and a payment request that
 * only works one way reads as a demand.
 *
 * **The invoice document travels with the letter.** It is attached rather than linked: the invoice
 * lives behind our operator login, and inventing a public URL for it would be a new unauthenticated
 * surface exposing one customer's billing to anyone who guessed an id. An attachment is what their
 * accountant wants anyway.
 *
 * **The expiry is stated.** A Stripe Checkout link dies after 24 hours, and a dead link handed to a
 * customer is worse than no link because they try it and conclude we are broken.
 */

export interface InvoiceEmailFacts {
  /** Our own gapless number — what both sides will call this document forever. */
  number: string;
  /** What they owe, already formatted with its currency. */
  amount: string;
  customerName: string;
  /** Absent when nothing is due yet. */
  dueDate?: string | null;
  /** The Stripe Checkout URL. Absent means bank transfer only, and the letter says so. */
  payUrl?: string | null;
  payLinkExpires?: string | null;
  /** Bank details, so the letter works for somebody with no card authority. */
  iban?: string | null;
  bankName?: string | null;
  /** Sandbox links charge nothing. Saying so stops a rehearsal being mistaken for a real request. */
  sandbox?: boolean;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

function build(args: SystemEmailArgs, subject: string): BuiltEmail {
  return { subject, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
}

/** "Here is your invoice, and here is a button." */
export function invoicePaymentRequestEmail(f: InvoiceEmailFacts): BuiltEmail {
  const blocks: SystemEmailBlock[] = [
    {
      p:
        `Invoice ${f.number} for ${f.amount} is attached.` +
        (f.dueDate ? ` It is due on ${f.dueDate}.` : ""),
    },
  ];

  if (f.payUrl) {
    blocks.push({ action: { label: `Pay ${f.amount} by card`, url: f.payUrl } });
    blocks.push({
      note:
        (f.sandbox
          ? "This is a TEST link — it charges nothing and exists so the process can be rehearsed. "
          : "") +
        (f.payLinkExpires
          ? `The card link stops working on ${f.payLinkExpires}; ask us for a new one and we will send it straight away.`
          : "The card link is time-limited; ask us for a new one if it has stopped working."),
    });
  }

  /*
   * Bank transfer is kept in the letter even when a card link exists. A hotel's finance person may
   * have no card authority at all, and a request that only works one way reads as a demand rather
   * than an invoice.
   */
  if (f.iban) {
    blocks.push({
      p: `Prefer a bank transfer? ${f.bankName ? `${f.bankName}, ` : ""}IBAN ${f.iban}. Please quote ${f.number} as the reference so we can match it.`,
    });
  }

  blocks.push({ note: "Reply to this email if anything on the invoice looks wrong — a person reads it." });

  return build(
    { preview: `Invoice ${f.number} — ${f.amount}`, heading: `Invoice ${f.number}`, blocks },
    `Revio invoice ${f.number} — ${f.amount}`,
  );
}

/** "We have it." Sent once the payment actually settles, never when a browser reaches a page. */
export function invoicePaidEmail(f: InvoiceEmailFacts & { paidOn: string }): BuiltEmail {
  const blocks: SystemEmailBlock[] = [
    { p: `We have received ${f.amount} for invoice ${f.number}. Thank you.` },
    {
      p:
        `The paid invoice is attached for your records. Nothing further is needed from you` +
        (f.sandbox ? " — though this was a TEST payment and no money actually moved." : "."),
    },
    { note: `Paid on ${f.paidOn}. Reply to this email if anything does not match your records.` },
  ];
  return build(
    { preview: `Payment received — ${f.amount}`, heading: "Payment received", blocks },
    `Payment received — Revio invoice ${f.number}`,
  );
}
