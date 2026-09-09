import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { Foldaway } from "./Foldaway";

/**
 * The folio's disclosure row, which is what replaced the idea of tabs.
 *
 * The assertions are the properties that make it safe at a front desk rather than merely tidy — each
 * one is a way the pattern could quietly become the thing it was chosen over.
 *
 *     PMS_PREVIEW_FILE=/tmp/foldaway.html pnpm --filter @revio/pms test
 */

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("Foldaway", () => {
  it("puts the state on the line, so most visits never open it", () => {
    // The whole reason this can stay shut: "are there deposits?" is answered without a click.
    const html = render(<Foldaway title="Deposits" state="None held"><p>body</p></Foldaway>);
    expect(html).toContain("Deposits");
    expect(html).toContain("None held");
  });

  it("stays closed by default", () => {
    // Everything open is the long page this replaced; the default has to be shut.
    expect(render(<Foldaway title="Invoicing" state="None issued yet"><p>b</p></Foldaway>)).not.toContain("<details open");
  });

  it("opens on arrival only when asked", () => {
    // Reserved for money that must be dealt with before the guest leaves.
    const html = render(<Foldaway title="Deposits" state="€50 held" defaultOpen><p>b</p></Foldaway>);
    expect(html).toContain("<details open");
  });

  /*
   * The property that separates this from tabs, and the reason `<details>` was chosen over a
   * hand-rolled disclosure: the content is IN THE DOCUMENT while collapsed. The browser's own
   * find-in-page reaches it, a screen reader can walk to it, and nothing has navigated away.
   */
  it("keeps the content in the page even while shut", () => {
    const html = render(<Foldaway title="Invoicing" state="None issued yet"><p>issue an invoice</p></Foldaway>);
    expect(html).toContain("issue an invoice");
  });

  it("is a real disclosure, not a div pretending", () => {
    // Keyboard-operable and semantic for free. A custom one would be a client bundle to do worse.
    const html = render(<Foldaway title="X" state="y"><p>b</p></Foldaway>);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });

  /*
   * Found by looking at the rendered row: "€50 held — apply or refund before checkout" was the same
   * quiet grey as "No invoice issued yet". One is a fact, the other is a job to do before the guest
   * leaves, and colour is read before words.
   */
  it("marks a state that needs doing differently from one that is merely true", () => {
    const job = render(<Foldaway title="Deposits" state="€50 held" tone="attention"><p>b</p></Foldaway>);
    const fact = render(<Foldaway title="Invoicing" state="None issued yet"><p>b</p></Foldaway>);
    expect(job).toContain("text-warning-700");
    expect(fact).toContain("text-ink-500");
    expect(fact).not.toContain("text-warning-700");
  });

  it("writes the visual fixture when asked", () => {
    const file = process.env.PMS_PREVIEW_FILE;
    if (!file) return;
    const css = process.env.PMS_PREVIEW_CSS ?? "";
    const rows = [
      ["Post a charge", "Minibar, an extra, a one-off fee", false, "quiet"],
      ["Stay extras", "2 recurring per night", false, "quiet"],
      ["Invoicing", "No invoice issued yet", false, "quiet"],
      ["Deposits", "€50.00 held — apply or refund before checkout", true, "attention"],
    ] as const;
    writeFileSync(
      file,
      `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">` +
        `<title>Folio — folded sections</title></head>` +
        `<body style="background:#f6f7f9;padding:28px;max-width:820px;margin:0 auto">` +
        `<div style="display:flex;flex-direction:column;gap:16px">` +
        rows
          .map(([t, s, open, tone]) =>
            render(
              <Foldaway title={t} state={s} defaultOpen={open} tone={tone}>
                <div className="p-4 text-[12.5px] text-ink-500">The section&rsquo;s own controls sit here.</div>
              </Foldaway>,
            ),
          )
          .join("") +
        `</div></body></html>`,
    );
  });
});
