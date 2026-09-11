import { prisma } from "./client.js";

/**
 * What a hotel may see about its own account with us.
 *
 * ## ⚠️ The third deliberate crossing of the operator perimeter, and the reason it is a function
 *
 * `Invoice` carries the `operator_only` policy, so a hotel session cannot read it. That policy is
 * right for the table as a whole — it holds what we bill every client — but it is plainly wrong for
 * one hotel's view of its own bill. An invoice is a document addressed to them; refusing to show it
 * to the person who has to pay it is not security, it is just awkward.
 *
 * So why not simply move `Invoice` to `tenant_isolation` and be done with it?
 *
 * **Because of drafts.** A draft is our working figure before anybody has decided to send it, and
 * `generateInvoices` deliberately *refreshes* a draft when pricing changes — "an unsent invoice at a
 * stale price is a wrong number waiting to be emailed". A hotel watching a number move around for
 * three days before it is issued would be reading our internal workings as though they were a bill.
 * Under a plain RLS policy, every hotel-side query would have to remember to exclude drafts. Here it
 * cannot be forgotten: there is one reader and it filters by construction.
 *
 * The same argument in one line: RLS decides *whose* rows; this decides *which* of their rows are
 * finished enough to show. Those are different questions and only one of them is a policy.
 */
export interface HotelInvoice {
  id: string;
  period: string;
  amountMinor: number;
  currency: string;
  /** `sent` | `paid`. A draft never reaches here. */
  status: string;
  lineItems: string | null;
  createdAt: Date;
  paidAt: Date | null;
  /** A live Stripe Checkout link, or null when there is none or it has expired. */
  payUrl: string | null;
  /** Test-mode links charge nothing. The screen has to be able to say so. */
  sandbox: boolean;
  refundedMinor: number;
  refundedAt: Date | null;
}

export async function hotelInvoices(tenantId: string, limit = 24): Promise<HotelInvoice[]> {
  const rows = await prisma.invoice.findMany({
    // ⚠️ Drafts are excluded HERE, not by the caller. See the note above.
    where: { tenantId, status: { in: ["sent", "paid"] } },
    orderBy: { period: "desc" },
    take: limit,
    select: {
      id: true, period: true, amountMinor: true, currency: true, status: true,
      lineItems: true, createdAt: true, paidAt: true,
      stripeCheckoutUrl: true, stripeCheckoutExpires: true, stripeMode: true,
      refundedMinor: true, refundedAt: true,
    },
  });

  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    period: r.period,
    amountMinor: r.amountMinor,
    currency: r.currency,
    status: r.status,
    lineItems: r.lineItems,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
    /*
     * An EXPIRED link is worse than no link: the customer clicks it, Stripe shows an error, and they
     * conclude our billing is broken rather than that a URL timed out. Stripe expires these after 24
     * hours, so the expiry is stored beside the link and checked here — the one place that can.
     * A paid invoice never offers one either; paying twice is not a thing to make easy.
     */
    payUrl:
      r.status !== "paid" && r.stripeCheckoutUrl && (!r.stripeCheckoutExpires || r.stripeCheckoutExpires > now)
        ? r.stripeCheckoutUrl
        : null,
    sandbox: r.stripeMode === "test",
    refundedMinor: r.refundedMinor,
    refundedAt: r.refundedAt,
  }));
}

/**
 * The facts a hotel's billing screen needs about the account itself, beside its invoices.
 *
 * Room count is `Unit` (the physical rooms), never `RoomType` (a catalogue of six to eleven). Using
 * the wrong one put the same client in two different pricing tiers on two different screens in the
 * operator console — and this screen shows the customer the tier, so getting it wrong here is a
 * number they can argue with.
 */
export async function hotelBillingAccount(tenantId: string): Promise<{
  plan: string;
  entitlements: { channelManager: boolean; reservation: boolean; pms: boolean };
  rooms: number;
  isDemo: boolean;
  /** Running trials, so the screen can say a product is not being charged for yet. */
  trials: { product: string; endsAt: Date }[];
} | null> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true, isDemo: true,
      hasChannelManager: true, hasReservation: true, hasPms: true,
      properties: { select: { _count: { select: { units: true } } } },
      productTrials: { where: { endedAt: null }, select: { product: true, endsAt: true } },
    },
  });
  if (!t) return null;
  return {
    plan: t.plan,
    entitlements: { channelManager: t.hasChannelManager, reservation: t.hasReservation, pms: t.hasPms },
    rooms: t.properties.reduce((sum, p) => sum + p._count.units, 0),
    isDemo: t.isDemo,
    trials: t.productTrials,
  };
}

/**
 * How to pay us — the same details already printed on every invoice we send.
 *
 * `OperatorCompany` is `operator_only` like `Invoice`, and for the same good reason: it holds our
 * VAT registration, our invoice-numbering range and our company record. This selects the handful of
 * fields that are **already on the document in the customer's hand** — who to pay and into which
 * account — and nothing else. Refusing to show a customer the bank account on their own bill would
 * be perimeter discipline mistaken for security.
 *
 * Returns `null` when the company record has not been filled in, rather than half a bank transfer.
 * A screen that prints an IBAN and no BIC has invented a payment instruction that does not work.
 */
export async function revioPaymentDetails(): Promise<{
  legalName: string;
  iban: string;
  bic: string | null;
  bankName: string | null;
  email: string | null;
} | null> {
  const c = await prisma.operatorCompany.findUnique({
    where: { id: "singleton" },
    select: { legalName: true, iban: true, bic: true, bankName: true, email: true },
  });
  if (!c?.iban) return null;
  return { legalName: c.legalName, iban: c.iban, bic: c.bic, bankName: c.bankName, email: c.email };
}
