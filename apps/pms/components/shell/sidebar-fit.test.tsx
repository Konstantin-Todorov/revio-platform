import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const state = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children),
}));
vi.mock("./ShellContext", () => ({ useShell: () => ({ open: true, setOpen: vi.fn() }) }));

import { Sidebar } from "./Sidebar";

/**
 * Does the whole menu fit on a laptop?
 *
 * The founder, 2026-09-11: *"in the pms and in other smaller laptop screens the menu on the left
 * have to be scrolled so you can see everything… some users might not have the intent to scroll on
 * the menu, they may not think of scrolling."*
 *
 * That is a discoverability failure, not a layout preference: a screen somebody never scrolls to is
 * a feature they never learn exists. RevioPMS is the worst case — the most items of the three — so
 * it is the one measured here.
 *
 *     SIDEBAR_PREVIEW=/tmp/sidebar.html SIDEBAR_CSS=/tmp/pms.css pnpm --filter @revio/pms test
 */

describe("the menu", () => {
  it("renders every destination an owner has", () => {
    const html = renderToStaticMarkup(React.createElement(Sidebar, { role: "owner", footer: "Hotel" }));
    for (const href of ["/dashboard", "/folios", "/housekeeping", "/closeday", "/help", "/settings"]) {
      expect(html, href).toContain(`href="${href}"`);
    }
  });

  it("keeps Settings the last link in the document", () => {
    // Whatever else moves, the bottom-most destination is Settings — see @revio/ui/nav-tail.
    const html = renderToStaticMarkup(React.createElement(Sidebar, { role: "owner", footer: "Hotel" }));
    const hrefs = [...html.matchAll(/href="(\/[a-z-]*)"/g)].map((m) => m[1]);
    expect(hrefs.at(-1)).toBe("/settings");
  });
});

it("writes a preview when asked", () => {
  const file = process.env.SIDEBAR_PREVIEW;
  if (!file) return;
  const css = process.env.SIDEBAR_CSS ?? "";
  const html = renderToStaticMarkup(React.createElement(Sidebar, { role: "owner", footer: "Hotel Sofia Group" }));
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head>` +
      `<body style="margin:0;background:#f7f8fa">${html}</body></html>`,
  );
  expect(html.length).toBeGreaterThan(0);
});
