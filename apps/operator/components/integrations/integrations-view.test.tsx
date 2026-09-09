import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

/*
 * The server actions these components submit to are irrelevant to what they LOOK like, and importing
 * them would drag Prisma into a render test. Same trick Sidebar.test.ts uses for ShellContext.
 */
vi.mock("@/lib/actions-integrations", () => ({
  setVatRegistration: "/__action",
  testStripeConnection: "/__action",
  removeStripeKey: "/__action",
  saveStripeKey: "/__action",
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children),
}));

import { VatRegistrationCard } from "@/components/billing/VatRegistrationCard";
import { vatThresholdStatus, thresholdAdvice } from "@/lib/vat-threshold";

/**
 * A contract test that doubles as the visual fixture.
 *
 * `docs/UI-STANDARD.md` rule 4 is "look at the rendered page", and it is there because both of this
 * week's UI defects — an invisible status dot and an unreadable support thread — passed every test
 * and every lint. This renders the real components with the app's own compiled CSS so they can be
 * looked at without a database, a login or a running server:
 *
 *     OPERATOR_PREVIEW_FILE=/tmp/preview.html pnpm --filter @revio/operator test
 *
 * The assertions below are the parts that must not silently change, and each is a thing that would
 * be wrong rather than merely different.
 */

const threshold = (turnoverMinor: number) =>
  vatThresholdStatus(
    [{ issuedAt: new Date("2026-03-01T12:00:00Z"), netMinor: turnoverMinor, amountMinor: turnoverMinor, buyerCountry: "BG", isDemo: false }],
    "BG",
    2026,
  );

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("VatRegistrationCard", () => {
  it("shows all three registrations, with the one in force selected", () => {
    const html = render(
      <VatRegistrationCard current="art97a" vatId="BG205090014" country="BG" canEdit threshold={threshold(1_000_00)} />,
    );
    expect(html).toContain('value="none"');
    expect(html).toContain('value="art97a"');
    expect(html).toContain('value="full"');
    // Exactly one checked — a form where none or two are selected is a form that cannot be read.
    expect([...html.matchAll(/checked=""/g)]).toHaveLength(1);
    // Read the whole tag rather than assuming attribute order: React emits `checked` BEFORE `value`,
    // and an order-sensitive regex here fails on correct markup, which is a worse test than none.
    const inputs = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
    const selected = inputs.filter((t) => t.includes('checked=""'));
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain('value="art97a"');
  });

  it("states the consequence of each option, not just its legal name", () => {
    // A radio labelled "чл. 97а" tells the person choosing nothing. The consequence is the label.
    const html = render(
      <VatRegistrationCard current="art97a" vatId="BG205090014" country="BG" canEdit threshold={threshold(1_000_00)} />,
    );
    expect(html).toMatch(/may not state VAT on a Bulgarian invoice/i);
    expect(html).toMatch(/charged the domestic rate/i);
  });

  /*
   * The bar's colour and the sentence beside it must never disagree. Found by looking at the
   * rendered page: a green bar sat over an amber "registration becomes mandatory" message, and
   * colour is read before words.
   */
  it("never shows a reassuring bar next to a warning sentence", () => {
    const approaching = threshold(40_000_00); // 78% — amber advice, and the bar was green
    expect(thresholdAdvice(approaching, "art97a")).not.toBeNull();
    const html = render(
      <VatRegistrationCard current="art97a" vatId="BG205090014" country="BG" canEdit threshold={approaching} />,
    );
    expect(html).not.toContain("bg-success-600");
    expect(html).toContain("bg-warning-600");
  });

  it("stays quiet far from the threshold and turns red past it", () => {
    const quiet = render(
      <VatRegistrationCard current="art97a" vatId="BG205090014" country="BG" canEdit threshold={threshold(1_000_00)} />,
    );
    expect(quiet).toContain("bg-success-600");
    expect(quiet).not.toContain("bg-danger-600");

    const over = render(
      <VatRegistrationCard current="art97a" vatId="BG205090014" country="BG" canEdit threshold={threshold(60_000_00)} />,
    );
    expect(over).toContain("bg-danger-600");
    expect(over).toMatch(/mandatory/);
    expect(over).toMatch(/7 days/);
  });

  /*
   * The same defect inverted, and found the same way. A fully-registered company at 120% of the
   * threshold got a RED bar and — correctly — no message, because there is nothing to do. Alarm with
   * no action attached teaches people to ignore the colour everywhere else.
   */
  it("shows no alarm to a company that is already fully registered", () => {
    const html = render(
      <VatRegistrationCard current="full" vatId="BG205090014" country="BG" canEdit threshold={threshold(60_000_00)} />,
    );
    expect(html).not.toContain("bg-danger-600");
    expect(html).not.toContain("bg-warning-600");
    expect(html).toMatch(/no longer applies/);
  });

  it("warns when a registration is claimed with no VAT number on file", () => {
    // An invoice claiming a registration has to print the number it was registered under.
    const html = render(
      <VatRegistrationCard current="art97a" vatId={null} country="BG" canEdit threshold={threshold(0)} />,
    );
    expect(html).toMatch(/No VAT number on file/);
  });

  it("renders read-only for a non-admin, with no save button to press", () => {
    const html = render(
      <VatRegistrationCard current="full" vatId="BG205090014" country="BG" canEdit={false} threshold={threshold(0)} />,
    );
    expect(html).toContain("disabled=");
    expect(html).not.toContain("Save VAT registration");
  });

  it("writes the visual fixture when asked", () => {
    const file = process.env.OPERATOR_PREVIEW_FILE;
    if (!file) return;
    const css = process.env.OPERATOR_PREVIEW_CSS ?? "";
    const panels = [
      ["Not registered · quiet", <VatRegistrationCard key="a" current="none" vatId={null} country="BG" canEdit threshold={threshold(2_000_00)} />],
      ["чл. 97а · approaching", <VatRegistrationCard key="b" current="art97a" vatId="BG205090014" country="BG" canEdit threshold={threshold(40_000_00)} />],
      ["чл. 97а · crossed", <VatRegistrationCard key="c" current="art97a" vatId="BG205090014" country="BG" canEdit threshold={threshold(60_000_00)} />],
      ["Fully registered · read-only", <VatRegistrationCard key="d" current="full" vatId="BG205090014" country="BG" canEdit={false} threshold={threshold(60_000_00)} />],
    ] as const;
    writeFileSync(
      file,
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<link rel="stylesheet" href="${css}"><title>Operator — VAT registration preview</title></head>` +
        `<body style="background:#f6f7f9;padding:24px;max-width:900px;margin:0 auto">` +
        panels
          .map(([label, el]) => `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:20px 0 6px">${label}</p>${render(el)}`)
          .join("") +
        `</body></html>`,
    );
  });
});
