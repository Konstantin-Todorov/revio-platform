import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const state = vi.hoisted(() => ({ pathname: "/overview", open: true }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children),
}));
vi.mock("./ShellContext", () => ({ useShell: () => ({ open: state.open, setOpen: vi.fn() }) }));
vi.mock("./Logo", () => ({ Logo: ({ className }: { className?: string }) => React.createElement("div", { className }) }));

import { Sidebar } from "./Sidebar";
import { AreaTabs } from "./AreaTabs";

/**
 * What the shell actually looks like — the check the last two attempts at this skipped.
 *
 * Two navigation rebuilds were rejected by the founder on appearance, not on behaviour, and both had
 * passing tests at the time. `docs/UI-STANDARD.md` rule 4 exists for exactly that: typecheck, tests
 * and eleven lints all pass on a screen nobody wants to look at.
 *
 *     OPERATOR_SHELL_PREVIEW=/tmp/shell.html pnpm --filter @revio/operator test
 */

beforeEach(() => {
  state.pathname = "/overview";
  state.open = true;
});

const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const sidebarAt = (pathname: string) => {
  state.pathname = pathname;
  return render(React.createElement(Sidebar));
};

describe("the sidebar", () => {
  it("lists seven areas and no screen names", () => {
    const html = sidebarAt("/overview");
    for (const label of ["Overview", "Clients", "Support", "Revenue", "Operations", "Product", "Settings"]) {
      expect(html).toContain(`>${label}</span>`);
    }
    // The screens are one level in now. Seeing them here would be the old flat list again.
    for (const screen of ["Demo requests", "Plans &amp; pricing", "Error log", "Auth log", "Connectivity", "Platform history"]) {
      expect(html).not.toContain(screen);
    }
  });

  it("marks exactly one area current, wherever you are", () => {
    // Two highlighted areas, or none, and the menu has stopped answering "where am I".
    for (const path of ["/overview", "/clients", "/leads", "/billing", "/auth-log", "/integrations/stripe", "/settings/company"]) {
      const current = [...sidebarAt(path).matchAll(/aria-current="page"/g)];
      expect(current, `on ${path}`).toHaveLength(1);
    }
  });

  it("keeps the area lit when you drill into a detail page", () => {
    const html = sidebarAt("/clients/abc123");
    expect(html).toMatch(/<a href="\/clients"[^>]*aria-current="page"/);
  });

  it("keeps the mobile drawer working", () => {
    state.open = false;
    expect(render(React.createElement(Sidebar))).toContain("-translate-x-full");
    state.open = true;
    const html = render(React.createElement(Sidebar));
    expect(html).toContain("translate-x-0");
    expect(html).toContain('aria-label="Close menu"');
  });
});

describe("the tab row", () => {
  const tabsAt = (pathname: string) => {
    state.pathname = pathname;
    return render(React.createElement(AreaTabs));
  };

  it("shows an area's screens, with the one you are on marked", () => {
    const html = tabsAt("/billing");
    expect(html).toContain("Plans &amp; pricing");
    expect(html).toContain("Billing");
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect(html).toMatch(/<a href="\/billing"[^>]*aria-current="page"/);
  });

  it("renders nothing at all where there is nothing to choose", () => {
    expect(tabsAt("/overview")).toBe("");
    expect(tabsAt("/settings")).toBe("");
    expect(tabsAt("/clients/abc123")).toBe("");
  });

  it("uses the same underline tabs as the client page, not a second dialect", () => {
    // These are the exact classes from `/clients/[id]`. If that pattern is restyled, this fails and
    // somebody has to restyle both — which is the point.
    const html = tabsAt("/health");
    expect(html).toContain("border-b-2");
    expect(html).toContain("border-brand-700 text-brand-800");
    expect(html).toContain("border-transparent text-ink-500");
  });

  it("lets five tabs scroll rather than pushing the page sideways", () => {
    expect(tabsAt("/health")).toContain("overflow-x-auto");
  });

  it("writes the visual fixture when asked", () => {
    const file = process.env.OPERATOR_SHELL_PREVIEW;
    if (!file) return;
    const css = process.env.OPERATOR_SHELL_CSS ?? "";
    const views: [string, string][] = [
      ["Operations · Integrations", "/integrations"],
      ["Revenue · Billing", "/billing"],
      ["Clients · list", "/clients"],
      ["Overview · no tabs", "/overview"],
    ];
    const body = views
      .map(([label, path]) => {
        state.pathname = path;
        const side = render(React.createElement(Sidebar));
        const tabs = render(React.createElement(AreaTabs));
        // `transform` on the wrapper makes it the containing block for the sidebar's `position:
        // fixed`, so each panel gets its own instead of all four stacking on the viewport.
        return `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:28px 0 8px">${label}</p>
          <div style="position:relative;transform:translateZ(0);height:520px;overflow:hidden;border:1px solid #e5e7eb;border-radius:12px;background:#f6f7f9">
            ${side}
            <div style="margin-left:248px;padding:24px">
              ${tabs}
              <h1 style="font:700 20px system-ui;color:#111827;margin:0 0 6px">${path}</h1>
              <p style="font:400 13px system-ui;color:#6b7280;margin:0">Page content sits here.</p>
            </div>
          </div>`;
      })
      .join("");
    writeFileSync(
      file,
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<link rel="stylesheet" href="${css}"><title>Operator shell preview</title></head>` +
        `<body style="background:#fff;padding:24px;max-width:1160px;margin:0 auto">${body}</body></html>`,
    );
  });
});
