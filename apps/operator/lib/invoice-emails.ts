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
  /**
   * Where they pay. Normally the invoice's own page (`/pay/<token>`), which never expires; a raw
   * Stripe Checkout URL is still accepted, with its expiry stated. Absent = bank transfer only.
   */
  payUrl?: string | null;
  payLinkExpires?: string | null;
  /** True when `payUrl` is the invoice's own page — it does not expire, so no expiry is stated. */
  payPage?: boolean;
  /** Bank details, so the letter works for somebody with no card authority. */
  iban?: string | null;
  bankName?: string | null;
  /** Sandbox links charge nothing. Saying so stops a rehearsal being mistaken for a real request. */
  sandbox?: boolean;
  /** The customer's language — the invoice's own. Absent = English. */
  lang?: "bg" | "en";
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

function build(args: SystemEmailArgs, subject: string): BuiltEmail {
  return { subject, text: renderSystemEmailText(args), html: renderSystemEmail(args) };
}

/**
 * Every sentence these letters say, in each language we invoice in. A language is an entry in this
 * table, never a branch in the builders below.
 */
const W = {
  en: {
    amountDue: "Amount due", due: "Due", invoice: "Invoice",
    attached: (c: string) => `The invoice is attached to this email${c ? ` for ${c}` : ""}.`,
    payCard: (a: string) => `Pay ${a} by card`,
    testLink: "This is a TEST link — it charges nothing and exists so the process can be rehearsed. ",
    expires: (e: string) => `The card link stops working on ${e}; ask us for a new one and we will send it straight away.`,
    limited: "The card link is time-limited; ask us for a new one if it has stopped working.",
    pageNote: "The link opens this invoice's own page — pay by card there, download the invoice, or see our bank details. It keeps working until the invoice is paid.",
    bank: (b: string | null, iban: string, n: string) => `Prefer a bank transfer? ${b ? `${b}, ` : ""}IBAN ${iban}. Please quote ${n} as the reference so we can match it.`,
    wrong: "Reply to this email if anything on the invoice looks wrong — a person reads it.",
    reqSubject: (n: string, a: string) => `Revio invoice ${n} — ${a}`,
    reqHeading: (n: string) => `Invoice ${n}`,
    thanks: "Thank you — your payment has been received in full.",
    amountPaid: "Amount paid", paidOn: "Paid on",
    paidAttached: (test: boolean) => `The paid invoice is attached for your records — it shows the settlement date and reference. Nothing further is needed from you${test ? ", though this was a TEST payment and no money actually moved" : ""}.`,
    paidWrong: "Reply to this email if anything does not match your records — a person reads it.",
    paidPreview: (a: string) => `Payment received — ${a}`, paidHeading: "Payment received",
    paidSubject: (n: string) => `Payment received — Revio invoice ${n}`,
    remind: {
      soon: { subject: (n: string, d: string) => `Reminder: invoice ${n} is due on ${d}`, lead: (d: string) => `A friendly reminder that this invoice is due on ${d}. If it is already on its way, thank you — please ignore this.` },
      due: { subject: (n: string) => `Invoice ${n} is due today`, lead: () => "This invoice is due today. If you have already paid, thank you — please ignore this." },
      overdue: { subject: (n: string) => `Invoice ${n} is overdue`, lead: (d: string) => `This invoice was due on ${d} and we have not received the payment yet. If it has crossed with this email, thank you — please ignore it; otherwise it can be paid in a minute from the link below.` },
    },
  },
  bg: {
    amountDue: "Сума за плащане", due: "Срок", invoice: "Фактура",
    attached: (c: string) => `Фактурата${c ? ` за ${c}` : ""} е приложена към този имейл.`,
    payCard: (a: string) => `Платете ${a} с карта`,
    testLink: "Това е ТЕСТОВА връзка — не таксува нищо и служи само за проба. ",
    expires: (e: string) => `Връзката за плащане с карта спира да работи на ${e}; пишете ни и веднага ще Ви изпратим нова.`,
    limited: "Връзката за плащане с карта е с ограничен срок; пишете ни за нова, ако е спряла да работи.",
    pageNote: "Връзката отваря страницата на тази фактура — там можете да платите с карта, да изтеглите фактурата или да видите банковите ни реквизити. Работи, докато фактурата не бъде платена.",
    bank: (b: string | null, iban: string, n: string) => `Предпочитате банков превод? ${b ? `${b}, ` : ""}IBAN ${iban}. Моля, посочете ${n} като основание, за да го свържем с фактурата.`,
    wrong: "Отговорете на този имейл, ако нещо във фактурата не е наред — чете го човек.",
    reqSubject: (n: string, a: string) => `Фактура от Revio № ${n} — ${a}`,
    reqHeading: (n: string) => `Фактура № ${n}`,
    thanks: "Благодарим Ви — получихме плащането в пълен размер.",
    amountPaid: "Платена сума", paidOn: "Дата на плащане",
    paidAttached: (test: boolean) => `Платената фактура е приложена за Вашата документация — на нея са датата и основанието на плащането. Не е нужно да правите нищо повече${test ? ", а и това беше ТЕСТОВО плащане — не са движени реални пари" : ""}.`,
    paidWrong: "Отговорете на този имейл, ако нещо не съвпада с Вашите записи — чете го човек.",
    paidPreview: (a: string) => `Плащането е получено — ${a}`, paidHeading: "Плащането е получено",
    paidSubject: (n: string) => `Плащането е получено — фактура от Revio № ${n}`,
    remind: {
      soon: { subject: (n: string, d: string) => `Напомняне: фактура № ${n} е с падеж ${d}`, lead: (d: string) => `Приятелско напомняне, че тази фактура е с падеж ${d}. Ако плащането вече е тръгнало — благодарим, не обръщайте внимание на този имейл.` },
      due: { subject: (n: string) => `Фактура № ${n} е с падеж днес`, lead: () => "Падежът на тази фактура е днес. Ако вече сте платили — благодарим, не обръщайте внимание на този имейл." },
      overdue: { subject: (n: string) => `Фактура № ${n} е просрочена`, lead: (d: string) => `Падежът на тази фактура беше ${d} и все още не сме получили плащането. Ако то се е разминало с този имейл — благодарим, не му обръщайте внимание; иначе може да се плати за минута от връзката по-долу.` },
    },
  },
} as const;

/** The pay button, its note, and the bank route — shared by the request and every reminder. */
function payBlocks(f: InvoiceEmailFacts): SystemEmailBlock[] {
  const w = W[f.lang ?? "en"];
  const blocks: SystemEmailBlock[] = [];
  if (f.payUrl) {
    blocks.push({ action: { label: w.payCard(f.amount), url: f.payUrl } });
    blocks.push({
      note:
        (f.sandbox ? w.testLink : "") +
        (f.payPage ? w.pageNote : f.payLinkExpires ? w.expires(f.payLinkExpires) : w.limited),
    });
  }
  /*
   * Bank transfer is kept in the letter even when a card link exists. A hotel's finance person may
   * have no card authority at all, and a request that only works one way reads as a demand rather
   * than an invoice.
   */
  if (f.iban) blocks.push({ p: w.bank(f.bankName ?? null, f.iban, f.number) });
  return blocks;
}

/** "Here is your invoice, and here is a button." */
export function invoicePaymentRequestEmail(f: InvoiceEmailFacts): BuiltEmail {
  const w = W[f.lang ?? "en"];
  /*
   * The facts first, as ROWS rather than prose. Somebody in a finance inbox scans for a number and a
   * date before they read a word, and the shell's `list` block renders exactly that.
   */
  const blocks: SystemEmailBlock[] = [
    { list: [`${w.amountDue} — ${f.amount}`, ...(f.dueDate ? [`${w.due} — ${f.dueDate}`] : []), `${w.invoice} — ${f.number}`] },
    { p: w.attached(f.customerName) },
    ...payBlocks(f),
    { note: w.wrong },
  ];
  return build({ preview: `${w.invoice} ${f.number} — ${f.amount}`, heading: w.reqHeading(f.number), blocks }, w.reqSubject(f.number, f.amount));
}

/**
 * A payment reminder — before the due date, on it, and after it.
 *
 * The same button and the same bank route as the request, so a reminder is always payable on its
 * own, and the tone moves only as far as the facts do: "a friendly reminder", "due today", "we have
 * not received it". Never a threat — a hotel that forgot is a customer, not a debtor.
 */
export function invoiceReminderEmail(f: InvoiceEmailFacts & { stage: "soon" | "due" | "overdue" }): BuiltEmail {
  const w = W[f.lang ?? "en"];
  const r = w.remind[f.stage];
  const due = f.dueDate ?? "";
  const blocks: SystemEmailBlock[] = [
    { p: r.lead(due) },
    { list: [`${w.amountDue} — ${f.amount}`, ...(f.dueDate ? [`${w.due} — ${f.dueDate}`] : []), `${w.invoice} — ${f.number}`] },
    ...payBlocks(f),
    { note: w.wrong },
  ];
  return build({ preview: r.subject(f.number, due), heading: w.reqHeading(f.number), blocks }, r.subject(f.number, due));
}

/** "We have it." Sent once the payment actually settles, never when a browser reaches a page. */
export function invoicePaidEmail(f: InvoiceEmailFacts & { paidOn: string }): BuiltEmail {
  const w = W[f.lang ?? "en"];
  const blocks: SystemEmailBlock[] = [
    { p: w.thanks },
    { list: [`${w.amountPaid} — ${f.amount}`, `${w.paidOn} — ${f.paidOn}`, `${w.invoice} — ${f.number}`] },
    /*
     * The attached document is now a PAID invoice, not the same bill again — the settlement stamp is
     * why: before it existed this attachment was identical to the request's, which reads as being
     * asked a second time.
     */
    { p: w.paidAttached(!!f.sandbox) },
    { note: w.paidWrong },
  ];
  return build({ preview: w.paidPreview(f.amount), heading: w.paidHeading, blocks }, w.paidSubject(f.number));
}
