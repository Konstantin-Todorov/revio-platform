/**
 * Which online payments a stay's folio must show — and which of them it does not show yet.
 *
 * Money reaches a stay online three ways: at booking on RevioDirect, as the agreed balance charged
 * before arrival, and through a payment link the hotel sent. The folio is opened lazily — when the
 * desk first looks at it, or at check-in — so a folio opened BEFORE the balance was charged, or before
 * the guest paid a link, never learned about that money. The desk then saw it outstanding and could
 * charge the guest a second time.
 *
 * So the folio reconciles: every time it is opened, each expected payment is compared against the
 * payment lines already on the stay's folios, matched by its Stripe reference. Matching is also
 * bounded by AMOUNT: a folio opened under the old rule carries one "Paid online" line that may
 * already include the balance; posting only what the folio is short of can never double-count it.
 */
export interface OnlinePaymentFacts {
  onlinePaidMinor: number | null;
  onlinePaymentRef: string | null;
  balanceChargeMinor: number | null;
  balanceChargedAt: Date | null;
  balancePaymentRef: string | null;
}

export type OnlinePaymentKind = "booking" | "balance" | "link";

export interface ExpectedPayment {
  kind: OnlinePaymentKind;
  ref: string | null;
  amountMinor: number;
}

export function expectedOnlinePayments(
  r: OnlinePaymentFacts,
  paidLinks: { paymentRef: string | null; amountMinor: number }[] = [],
): ExpectedPayment[] {
  const balance = r.balanceChargedAt && (r.balanceChargeMinor ?? 0) > 0 ? r.balanceChargeMinor! : 0;
  // `onlinePaidMinor` is what was taken at booking PLUS the balance once charged.
  const atBooking = Math.max(0, (r.onlinePaidMinor ?? 0) - balance);
  const out: ExpectedPayment[] = [];
  if (atBooking > 0) out.push({ kind: "booking", ref: r.onlinePaymentRef, amountMinor: atBooking });
  if (balance > 0) out.push({ kind: "balance", ref: r.balancePaymentRef, amountMinor: balance });
  for (const l of paidLinks) if (l.amountMinor > 0) out.push({ kind: "link", ref: l.paymentRef, amountMinor: l.amountMinor });
  return out;
}

/**
 * What to post: the expected payments whose reference is not on the folio yet, capped so the total
 * of online payment lines never exceeds the total expected.
 */
export function missingOnlinePayments(
  expected: ExpectedPayment[],
  posted: { ref: string | null; amountMinor: number }[],
): ExpectedPayment[] {
  const refs = new Set(expected.map((e) => e.ref).filter((x): x is string => !!x));
  const postedOnline = posted.filter((p) => p.ref && refs.has(p.ref)).reduce((s, p) => s + p.amountMinor, 0);
  let room = expected.reduce((s, e) => s + e.amountMinor, 0) - postedOnline;
  const present = new Set(posted.map((p) => p.ref).filter(Boolean));
  const out: ExpectedPayment[] = [];
  for (const e of expected) {
    if (room <= 0) break;
    if (e.ref && present.has(e.ref)) continue;
    const amount = Math.min(e.amountMinor, room);
    out.push({ ...e, amountMinor: amount });
    room -= amount;
  }
  return out;
}
