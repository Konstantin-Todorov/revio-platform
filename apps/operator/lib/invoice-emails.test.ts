import { describe, it, expect } from "vitest";
import { invoicePaymentRequestEmail, invoicePaidEmail } from "./invoice-emails";

/**
 * What a customer reads when we ask them for money.
 *
 * Every assertion here is a decision that could reasonably have gone the other way, which is why it
 * is pinned: the only other way to see any of it is to send yourself an email.
 */

const BASE = {
  number: "REV-2026-0042",
  amount: "€144.00",
  customerName: "Cabacum Beach Residence",
  dueDate: "25/09/2026",
  iban: "BG80BNBG96611020345678",
  bankName: "UniCredit Bulbank",
};

describe("the payment request", () => {
  it("puts the number and the amount in the SUBJECT", () => {
    // Half of recipients decide whether to open from the subject alone, and "Invoice from Revio"
    // tells a finance inbox nothing it needs to triage on.
    const m = invoicePaymentRequestEmail({ ...BASE, payUrl: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(m.subject).toContain("REV-2026-0042");
    expect(m.subject).toContain("€144.00");
  });

  it("renders the pay link as a BUTTON and as a bare URL", () => {
    /*
     * The shell renders both deliberately: corporate mail gateways rewrite, wrap and sometimes strip
     * buttons, and a URL a person can select is the version that always survives. It also lets
     * somebody see where a link goes before clicking — the best anti-phishing affordance an email
     * has, and this is a mail asking for money.
     */
    const url = "https://checkout.stripe.com/c/pay/cs_1";
    const m = invoicePaymentRequestEmail({ ...BASE, payUrl: url });
    expect(m.html).toContain(url);
    expect(m.html).toMatch(/Pay €144\.00 by card/);
    expect(m.text).toContain(url);
  });

  /*
   * THE one that keeps this a letter rather than a demand. A hotel's finance person may have no card
   * authority at all; an invoice that can only be paid one way is a problem they cannot solve.
   */
  it("keeps bank transfer in the letter EVEN when a card link exists", () => {
    const m = invoicePaymentRequestEmail({ ...BASE, payUrl: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(m.text).toContain("BG80BNBG96611020345678");
    expect(m.text).toMatch(/quote REV-2026-0042 as the reference/);
  });

  it("still works as an invoice with no card link at all", () => {
    const m = invoicePaymentRequestEmail({ ...BASE, payUrl: null });
    expect(m.text).not.toMatch(/by card/);
    expect(m.text).toContain("BG80BNBG96611020345678");
  });

  it("states when the card link dies", () => {
    // A dead link handed to a customer is worse than no link, because they try it and conclude we
    // are broken.
    const m = invoicePaymentRequestEmail({
      ...BASE, payUrl: "https://checkout.stripe.com/c/pay/cs_1", payLinkExpires: "12/09/2026, 14:00",
    });
    expect(m.text).toContain("12/09/2026, 14:00");
  });

  it("says plainly when a link is a rehearsal", () => {
    // A sandbox link looks identical to a real one. Somebody must not believe they have paid.
    const m = invoicePaymentRequestEmail({ ...BASE, payUrl: "https://checkout.stripe.com/c/pay/cs_1", sandbox: true });
    expect(m.text).toMatch(/TEST link/);
    expect(m.text).toMatch(/charges nothing/);
  });

  it("does not invent a due date it was not given", () => {
    const m = invoicePaymentRequestEmail({ ...BASE, dueDate: null, payUrl: null });
    expect(m.text).not.toMatch(/due on/);
  });

  it("never puts a javascript: URL in an href, and renders no button for one", () => {
    /*
     * The one mistake in an email template that turns a letter into an exploit, in the clients that
     * still honour it.
     *
     * The assertion is deliberately about the HREF rather than about the document. `safeUrl` refuses
     * anything but http(s) and falls back to escaped plain TEXT, so the string is present and inert
     * — which is the safe outcome, not a leak. A test that banned the substring outright would fail
     * on correct behaviour, which is a worse test than none.
     */
    const m = invoicePaymentRequestEmail({ ...BASE, payUrl: "javascript:alert(1)" });
    expect(m.html).not.toMatch(/href="javascript:/i);
    expect(m.html).not.toMatch(/href='javascript:/i);
    // And no button at all — a link we cannot vouch for is not rendered as one.
    expect(m.html).not.toMatch(/Pay €144\.00 by card<\/a>/);
  });
});

describe("the receipt", () => {
  it("leads with the money and the number", () => {
    const m = invoicePaidEmail({ ...BASE, paidOn: "11/09/2026" });
    expect(m.subject).toContain("REV-2026-0042");
    expect(m.text).toContain("€144.00");
    expect(m.text).toContain("11/09/2026");
  });

  it("asks the customer for nothing", () => {
    // A receipt with a call to action on it reads as a second request for the same money.
    const m = invoicePaidEmail({ ...BASE, paidOn: "11/09/2026" });
    expect(m.text).toMatch(/Nothing further is needed/);
    expect(m.html).not.toMatch(/Pay .* by card/);
  });

  it("admits when the payment was a test", () => {
    const m = invoicePaidEmail({ ...BASE, paidOn: "11/09/2026", sandbox: true });
    expect(m.text).toMatch(/TEST payment/);
    expect(m.text).toMatch(/no money actually moved/);
  });

  it("invites a reply, because a wrong number needs a person", () => {
    expect(invoicePaidEmail({ ...BASE, paidOn: "11/09/2026" }).text).toMatch(/Reply to this email/);
  });
});
