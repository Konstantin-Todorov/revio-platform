import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";

vi.mock("@/lib/actions-signup", () => ({ submitSignup: () => {} }));
vi.mock("next/link", () => ({
  default: ({ children, ...p }: React.ComponentProps<"a">) => React.createElement("a", p, children),
}));

import { SignupForm } from "@/components/auth/SignupForm";

/**
 * The signup form, rendered.
 *
 *     SIGNUP_PREVIEW=/tmp/signup.html SIGNUP_CSS=/tmp/cm.css pnpm --filter @revio/channel-manager test
 */
describe("SignupForm", () => {
  const html = renderToStaticMarkup(<SignupForm />);

  it("asks in the hotel's words, not in ours", () => {
    // A hotelier can always answer "what do you need most". They cannot answer "which product" —
    // and a wrong answer used to burn the only trial of the product they needed.
    expect(html).toContain("What do you need most right now?");
    expect(html).toContain("Stop the OTAs double-booking my rooms");
    expect(html).toContain("Run the front desk and housekeeping");
  });

  it("says plainly that the choice does not limit what they get", () => {
    expect(html).toContain("all three for 30 days");
    expect(html).toMatch(/only decides where we open first/);
  });

  it("names the product beside each need, so the words are learnable", () => {
    for (const p of ["RevioLink", "RevioCRS", "RevioPMS"]) expect(html).toContain(p);
  });

  it("opens on a chosen option rather than making an empty form the first impression", () => {
    expect(html).toContain('aria-pressed="true"');
  });

  it("promises no card, which is the objection that stops a signup", () => {
    expect(html).toMatch(/No card needed/i);
  });

  it("writes a preview when asked", () => {
    const out = process.env.SIGNUP_PREVIEW;
    if (!out) return;
    const css = readFileSync(process.env.SIGNUP_CSS!, "utf8");
    writeFileSync(
      out,
      `<!doctype html><meta charset=utf8><style>${css}</style><body style="margin:0">` +
        `<div class="bg-surface-muted p-8"><div class="mx-auto w-full max-w-md">` +
        `<h2 class="text-[20px] font-bold tracking-tight text-ink-900">Start your free trial</h2>` +
        `<p class="mb-5 mt-1 text-[13px] text-ink-500">Thirty days of all three Revio products. No card, no call.</p>` +
        html + `</div></div></body>`,
    );
  });
});
