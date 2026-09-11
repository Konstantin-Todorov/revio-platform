import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { billingIdentityPrompt, type BillingIdentity } from "@revio/core";
import { BillingIdentityForm, type BillingIdentityResult } from "@revio/ui/billing-identity-form";

/**
 * The form where a hotel types its own company details for the invoices we issue it.
 *
 * The thing worth pinning is that every field required to issue a tax document is on screen and
 * marked, because the alternative is discovering the gap on the day an invoice is due.
 */

const EMPTY: Record<string, string> = {
  legalName: "", country: "", companyId: "", vatId: "",
  addressLine: "", city: "", postCode: "", billingEmail: "", attention: "",
};

const noop = async (): Promise<BillingIdentityResult> => ({ ok: true });

const form = (values = EMPTY, selfServedAt: Date | null = null) =>
  renderToStaticMarkup(
    React.createElement(BillingIdentityForm, {
      values: values as never,
      action: noop as never,
      selfServedAt,
    }),
  );

describe("the form", () => {
  it("asks for every field a tax invoice needs", () => {
    const html = form();
    for (const name of ["legalName", "country", "companyId", "vatId", "addressLine", "city", "postCode"]) {
      expect(html, name).toContain(`name="${name}"`);
    }
  });

  it("marks the four that block an invoice, and only those", () => {
    // `legalName`, `country`, `addressLine`, `city` — the set `validateBillingIdentity` refuses on.
    // A VAT number is NOT among them: plenty of small hotels are not registered.
    const required = [...form().matchAll(/for="bi-([a-zA-Z]+)"[\s\S]{0,180}?aria-hidden="true">\*/g)].map((m) => m[1]);
    expect(new Set(required)).toEqual(new Set(["legalName", "country", "addressLine", "city"]));
  });

  it("says the country is what decides VAT, where somebody reads it", () => {
    expect(form()).toMatch(/it decides whether VAT applies/i);
  });

  it("tells a hotel that is not VAT registered to leave it blank", () => {
    // Without this the field reads as required and somebody invents a number.
    expect(form()).toMatch(/Leave blank if you are not VAT registered/);
  });

  it("shows what they already entered, and when they entered it", () => {
    const html = form({ ...EMPTY, legalName: "Cabacum Beach EOOD" }, new Date("2026-09-11"));
    expect(html).toContain('value="Cabacum Beach EOOD"');
    expect(html).toMatch(/Last updated by you on 11 September 2026/);
  });
});

describe("what a hotel with nothing filled in is told", () => {
  it("names the consequence honestly and never threatens their access", () => {
    /*
     * ⚠️ A hotel that has not typed its VAT number is not a hotel whose front desk should stop
     * working. Holding a check-in hostage over a form is not something this platform does, so the
     * prompt says the only true consequence: we cannot send them an invoice.
     */
    const prompt = billingIdentityPrompt(null)!;
    expect(prompt).toMatch(/cannot issue you an invoice/i);
    expect(prompt).not.toMatch(/suspend|disable|lose access|stop working/i);
  });

  it("names exactly what is still missing", () => {
    const half = { ...EMPTY, legalName: "X", addressLine: "Y" } as unknown as BillingIdentity;
    const prompt = billingIdentityPrompt(half)!;
    expect(prompt).toMatch(/country/i);
    expect(prompt).toMatch(/city/i);
    expect(prompt).not.toMatch(/registered company name/i);
  });
});

it("writes a preview when asked", () => {
  const file = process.env.IDENTITY_PREVIEW;
  if (!file) return;
  const css = process.env.BILLING_CSS ?? "";
  const filled = {
    legalName: "Кабакум Бийч Резиденс ЕООД", country: "BG", companyId: "203456789",
    vatId: "BG203456789", addressLine: "ул. Христо Ботев 14", city: "Варна",
    postCode: "9000", billingEmail: "accounts@cabacum.bg", attention: "Accounts payable",
  };
  const card = (prompt: string | null, html: string) =>
    `<section class="rounded-xl border p-5 ${prompt ? "border-warning-200 bg-warning-50" : "border-surface-border bg-white"}">
      <h2 class="text-[13.5px] font-semibold text-ink-900">Your company details</h2>
      <p class="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-600">These go on the invoices <strong>Revio issues to you</strong> — not on the invoices you issue your guests, which are set up separately under your property.</p>
      ${prompt ? `<p class="mt-3 rounded-md border border-warning-200 bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning-800">${prompt}</p>` : ""}
      <div class="mt-4">${html}</div>
    </section>`;
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head>` +
      `<body style="margin:0;padding:24px;background:#f7f8fa;max-width:900px">` +
      `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:0 0 8px">Nothing filled in yet</p>` +
      card(billingIdentityPrompt(null), form()) +
      `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:28px 0 8px">Complete</p>` +
      card(null, form(filled, new Date("2026-09-11"))) +
      `</body></html>`,
  );
  expect(true).toBe(true);
});
