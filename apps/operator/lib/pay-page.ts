import "server-only";
import { forSystem } from "@revio/db";

/**
 * The invoice behind a `/pay/<token>` link, or null. The token is the whole key — 24 random bytes,
 * never derived from the invoice id — so a wrong or guessed one finds nothing, and nothing says
 * whether an invoice exists.
 */
export async function invoiceByPayToken(token: string) {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const invoice = await forSystem().invoice.findUnique({ where: { payToken: token } });
  if (!invoice?.number) return null;
  return invoice;
}

export const PAY_WORDS = {
  en: {
    title: (n: string) => `Invoice ${n}`, from: "From", to: "To",
    due: "Amount due", paidTotal: "Paid", dueOn: (d: string) => `Due ${d}`, overdue: (d: string) => `Overdue since ${d}`,
    paid: "Paid — thank you.", paidOn: (d: string) => `Payment received on ${d}.`,
    returned: "Thank you — your payment is being confirmed. The receipt will arrive by email in a moment.",
    card: "Pay by card", cardNote: "Secure payment by Stripe. We never see your card number.",
    testNote: "TEST mode — this charges nothing.",
    noCard: "Card payment is not available for this invoice right now — please pay by bank transfer below.",
    bank: "Or pay by bank transfer", bankOnly: "Pay by bank transfer", bankName: "Bank", reference: "Reference", download: "Download the invoice",
    qr: "Scan it with your banking app — the amount and the reference fill in by themselves. If your app does not read it, use the details above.",
    questions: (e: string) => `Questions about this invoice? Write to ${e}.`,
  },
  bg: {
    title: (n: string) => `Фактура № ${n}`, from: "От", to: "За",
    due: "Сума за плащане", paidTotal: "Платено", dueOn: (d: string) => `Падеж ${d}`, overdue: (d: string) => `Просрочена от ${d}`,
    paid: "Платена — благодарим Ви.", paidOn: (d: string) => `Плащането е получено на ${d.replace(/\.$/, "")}.`, // a Bulgarian date already ends "г."
    returned: "Благодарим Ви — плащането се потвърждава. Разписката ще пристигне по имейл след малко.",
    card: "Платете с карта", cardNote: "Сигурно плащане чрез Stripe. Номерът на картата Ви никога не стига до нас.",
    testNote: "ТЕСТОВ режим — нищо не се таксува.",
    noCard: "В момента тази фактура не може да се плати с карта — моля, платете с банков превод по-долу.",
    bank: "Или платете с банков превод", bankOnly: "Платете с банков превод", bankName: "Банка", reference: "Основание", download: "Изтеглете фактурата",
    qr: "Сканирайте го с приложението на банката си — сумата и основанието се попълват сами. Ако приложението не го чете, използвайте данните по-горе.",
    questions: (e: string) => `Въпроси за фактурата? Пишете на ${e}.`,
  },
} as const;
