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
import { SectionPanel } from "./SectionPanel";

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

describe("the icon rail — level 1", () => {
  it("shows seven areas as icons, with no screen names on it at all", () => {
    const html = sidebarAt("/overview");
    // Labels ride along as tooltips and aria-labels; what must NOT appear is the level below.
    for (const label of ["Overview", "Clients", "Support", "Revenue", "Operations", "Product", "Settings"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    for (const section of ["Demo requests", "Error log", "Auth log", "Platform history", "Your account"]) {
      expect(html).not.toContain(section);
    }
  });

  it("gives every icon a name, because an icon-only rail is otherwise unusable", () => {
    // Without this it is unreadable to a screen reader and unlearnable on a first day.
    const html = sidebarAt("/overview");
    expect([...html.matchAll(/aria-label="/g)].length).toBeGreaterThanOrEqual(7);
  });

  it("marks exactly one area current, wherever you are", () => {
    for (const path of ["/overview", "/clients", "/leads", "/billing", "/auth-log", "/integrations/stripe", "/settings/company"]) {
      const current = [...sidebarAt(path).matchAll(/aria-current="page"/g)];
      // One in the rail, plus one in the panel when there is a panel — never zero, never two in
      // the same list. Zero means the menu has stopped answering "where am I".
      expect(current.length, `on ${path}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps the area lit when you drill into a detail page", () => {
    expect(sidebarAt("/clients/abc123")).toMatch(/<a[^>]*href="\/clients"[^>]*aria-current="page"/);
  });

  it("keeps the mobile drawer working", () => {
    state.open = false;
    expect(render(React.createElement(Sidebar))).toContain("-translate-x-full");
    state.open = true;
    const html = render(React.createElement(Sidebar));
    expect(html).toContain("translate-x-0");
    expect(html).toContain('aria-label="Close menu"');
  });

  it("gives a phone a labelled list rather than a rail of bare icons", () => {
    // The rail trades width for two levels on screen; a phone has no width to trade, so the same
    // routes are flattened into one labelled list instead.
    const html = sidebarAt("/health");
    expect(html).toContain("lg:hidden");
    expect(html).toContain("Platform health"); // the section, spelled out, in the mobile list
  });
});

describe("the section panel — level 2", () => {
  const panelAt = (pathname: string) => {
    state.pathname = pathname;
    return render(React.createElement(SectionPanel));
  };

  it("lists the area's sections down the side, with the open one marked", () => {
    const html = panelAt("/billing");
    expect(html).toContain("Plans &amp; pricing");
    expect(html).toContain("Billing");
    expect([...html.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect(html).toMatch(/href="\/billing"[^>]*aria-current="page"/);
  });

  it("names the area above its sections, so the panel says where you are", () => {
    expect(panelAt("/health")).toContain(">Operations</h2>");
    expect(panelAt("/settings/company")).toContain(">Settings</h2>");
  });

  it("renders nothing at all where there is nothing to choose", () => {
    expect(panelAt("/overview")).toBe("");
    expect(panelAt("/support")).toBe("");
  });

  it("stays put on a detail page instead of vanishing", () => {
    // Down the side it competes with the page's own tabs for nothing, so unlike the horizontal
    // version it replaced, it can stay — and losing the menu when you drill in strands people.
    const html = panelAt("/integrations/stripe");
    expect(html).toContain("Integrations");
    expect(html).toMatch(/href="\/integrations"[^>]*aria-current="page"/);
  });

  it("explains only the section you are on", () => {
    // A line under every row turns the panel into a wall of text — the exact problem the icon rail
    // just solved one level up.
    const html = panelAt("/health");
    expect(html).toContain("Sync, jobs and errors across every hotel");
    expect(html).not.toContain("Application faults, grouped");
  });

  it("writes the visual fixture when asked", () => {
    const file = process.env.OPERATOR_SHELL_PREVIEW;
    if (!file) return;
    const css = process.env.OPERATOR_SHELL_CSS ?? "";
    const views: [string, string][] = [
      ["Operations · Integrations", "/integrations"],
      ["Settings · Company details", "/settings/company"],
      ["Revenue · Billing", "/billing"],
      ["Overview · no panel", "/overview"],
    ];
    const body = views
      .map(([label, path]) => {
        state.pathname = path;
        const side = render(React.createElement(Sidebar));
        const panel = render(React.createElement(SectionPanel));
        const offset = panel === "" ? 68 : 300;
        // `transform` on the wrapper makes it the containing block for the chrome's `position:
        // fixed`, so each panel gets its own instead of all four stacking on the viewport.
        return `<p style="font:600 11px system-ui;text-transform:uppercase;letter-spacing:.08em;color:#8b93a1;margin:28px 0 8px">${label}</p>
          <div class="preview-frame" style="position:relative;transform:translateZ(0);height:520px;overflow:hidden;border:1px solid #e5e7eb;border-radius:12px;background:#f6f7f9">
            ${side}
            <div style="margin-left:${offset}px;padding:24px">
              <h1 style="font:700 20px system-ui;color:#111827;margin:0 0 6px">${path}</h1>
              <p style="font:400 13px system-ui;color:#6b7280;margin:0">Page content sits here.</p>
            </div>
          </div>`;
      })
      .join("");
    writeFileSync(
      file,
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<link rel="stylesheet" href="${css}">` +
        /*
         * The chrome is `h-screen` — 100vh, measured against the VIEWPORT, not against whatever box
         * it is nested in. Inside a 520px preview frame that makes it taller than its own frame, and
         * the Settings icon (pushed to the bottom with `mt-auto`) is clipped out of sight. It looked
         * exactly like a missing icon the first time, which is a good reminder that a fixture can
         * lie in both directions.
         */
        `<style>.preview-frame aside{height:100%!important}</style>` +
        `<title>Operator shell preview</title></head>` +
        `<body style="background:#fff;padding:24px;max-width:1160px;margin:0 auto">${body}</body></html>`,
    );
  });
});
