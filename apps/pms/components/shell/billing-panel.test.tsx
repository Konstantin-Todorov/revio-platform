import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { billableEntitlements, entitlementsFor, priceBreakdown, tierForRooms } from "@revio/core";
import { BillingPanel, type BillingInvoiceRow } from "@revio/ui/billing-panel";

/**
 * The hotel's own bill, rendered.
 *
 * This screen shows a customer a number with our name on it, so the two things worth pinning are
 * that the arithmetic on screen is the arithmetic that produced the invoice, and that a product on
 * a free trial is visibly not in the total.
 *
 *     BILLING_PREVIEW=/tmp/billing.html BILLING_CSS=/tmp/pms.css pnpm --filter @revio/pms test
 */

const PAYMENT = {
  legalName: "Revio Software EOOD",
  iban: "BG80BNBG96611020345678",
  bic: "UNCRBGSF",
  bankName: "UniCredit Bulbank",
  email: "billing@reviosoft.app",
};

const invoice = (o: Partial<BillingInvoiceRow> = {}): BillingInvoiceRow => ({
  id: "i1", period: "2026-08", amountMinor: 14_160, currency: "EUR", status: "paid",
  lineItems: "Growth plan · RevioLink, RevioCRS", paidAt: new Date("2026-09-03"),
  payUrl: null, sandbox: false, refundedMinor: 0, ...o,
});

const panel = (props: Partial<React.ComponentProps<typeof BillingPanel>> = {}) => {
  const ent = entitlementsFor(["channelManager", "reservation"]);
  return renderToStaticMarkup(
    React.createElement(BillingPanel, {
      breakdown: priceBreakdown("growth", ent),
      planLabel: tierForRooms(38).label,
      rooms: 38,
      trials: [],
      invoices: [invoice()],
      payment: PAYMENT,
      ...props,
    }),
  );
};

describe("the number and the arithmetic behind it", () => {
  it("shows the total, and every line that adds up to it", () => {
    const html = panel();
    // Platform fee 50.00 + CM 49.00 + CRS 59.00 = 158.00, less 10% of the MODULES (never of the
    // platform fee) = 147.20. Spelled out because that exact distinction is the thing a customer
    // would query, and the thing a careless edit would break.
    expect(html).toContain("€147.20");
    expect(html).toContain("€50.00");
    expect(html).toContain("RevioLink");
    expect(html).toContain("RevioCRS");
  });

  it("shows the bundle discount as a credit, and says why it exists", () => {
    const html = panel();
    expect(html).toContain("− €10.80");
    // The discount is the price list agreeing with the architecture. If the sentence goes, the
    // number looks arbitrary and the customer has no way to check it is not a mistake.
    expect(html).toMatch(/cost us far less to run/);
  });

  /*
   * THE one this screen exists to get right. A trialled product has its entitlement flag ON, which
   * is how the hotel gets access — and is why `generateInvoices` was charging for it until this was
   * built. The screen must show the same figure the invoice will.
   */
  it("leaves a trialled product out of the total and says so in words", () => {
    const held = entitlementsFor(["channelManager", "reservation", "pms"]);
    const html = panel({
      breakdown: priceBreakdown("growth", billableEntitlements(held, ["pms"])),
      trials: [{ name: "RevioPMS", endsAt: new Date("2026-10-01") }],
    });
    expect(html).toContain("€147.20"); // unchanged by the trial
    expect(html).toMatch(/RevioPMS is on a free trial and is not in the figure above/);
    expect(html).toMatch(/nothing starts charging on its own/);
  });

  it("does not decide VAT, it says where VAT is decided", () => {
    // Three registrations, not two — under чл. 97а we may not state VAT on a domestic invoice at
    // all. A rate asserted by a dashboard would be a tax statement nobody checked.
    expect(panel()).toMatch(/your invoice states the treatment that was applied to it/i);
  });
});

describe("what is owed", () => {
  it("leads with an unpaid invoice and totals it", () => {
    const html = panel({ invoices: [invoice({ status: "sent", paidAt: null, amountMinor: 14_160 })] });
    expect(html).toMatch(/One invoice is waiting to be paid/);
    // Grouped in fours, as a bank prints it — a run of 22 characters is what people mis-copy.
    expect(html).toContain("BG80 BNBG 9661 1020 3456 78");
  });

  it("says nothing about payment when everything is paid", () => {
    expect(panel()).not.toMatch(/waiting to be paid/);
  });

  it("offers a card button only where a live link exists", () => {
    expect(panel()).not.toContain("Pay by card");
    const live = panel({ invoices: [invoice({ status: "sent", paidAt: null, payUrl: "https://checkout.stripe.com/c/pay/cs_1" })] });
    expect(live).toContain("Pay by card");
  });

  it("marks a test link as one, because it looks identical and takes no money", () => {
    const html = panel({
      invoices: [invoice({ status: "sent", paidAt: null, payUrl: "https://checkout.stripe.com/c/pay/cs_1", sandbox: true })],
    });
    expect(html).toMatch(/charges nothing/);
  });

  it("states a refund beside the amount and never subtracts it from it", () => {
    // The invoice still records what was supplied and what was paid; the refund is a later fact.
    const html = panel({ invoices: [invoice({ refundedMinor: 5_000 })] });
    expect(html).toContain("€141.60");
    expect(html).toMatch(/€50\.00 refunded/);
  });

  it("explains an empty history instead of showing an empty table", () => {
    expect(panel({ invoices: [] })).toMatch(/Nothing has been invoiced yet/);
  });
});

it("writes a preview when asked", () => {
  const file = process.env.BILLING_PREVIEW;
  if (!file) return;
  const css = process.env.BILLING_CSS ?? "";
  const held = entitlementsFor(["channelManager", "reservation", "pms"]);
  const views: [string, string][] = [
    ["Everything paid, two products", panel()],
    [
      "One outstanding, a card link, and RevioPMS on trial",
      panel({
        breakdown: priceBreakdown("growth", billableEntitlements(held, ["pms"])),
        trials: [{ name: "RevioPMS", endsAt: new Date("2026-10-01") }],
        invoices: [
          invoice({ id: "a", period: "2026-09", status: "sent", paidAt: null, payUrl: "https://checkout.stripe.com/c/pay/cs_1" }),
          invoice({ id: "b", period: "2026-08" }),
          invoice({ id: "c", period: "2026-07", refundedMinor: 5_000 }),
        ],
      }),
    ],
    ["A new hotel with nothing invoiced yet", panel({ invoices: [] })],
  ];
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<link rel="stylesheet" href="${css}"></head><body style="margin:0;padding:24px;background:#f7f8fa;max-width:900px">` +
      views
        .map(([label, html]) =>
          `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:28px 0 8px">${label}</p>${html}`,
        )
        .join("") +
      `</body></html>`,
  );
  expect(views.length).toBe(3);
});
