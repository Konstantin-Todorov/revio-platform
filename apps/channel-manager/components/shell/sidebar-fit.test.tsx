import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";

const state = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children),
}));
vi.mock("./ShellContext", () => ({ useShell: () => ({ open: true, setOpen: vi.fn() }) }));

import { Sidebar } from "./Sidebar";

/** Preview only — see apps/pms/components/shell/sidebar-fit.test.tsx for what this is measuring. */
it("writes a preview when asked", () => {
  const file = process.env.SIDEBAR_PREVIEW;
  if (!file) return;
  const css = process.env.SIDEBAR_CSS ?? "";
  const html = renderToStaticMarkup(React.createElement(Sidebar, { connectivityLabel: "Channex · live" }));
  writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}"></head>` +
      `<body style="margin:0;background:#f7f8fa">${html}</body></html>`,
  );
  expect(html.length).toBeGreaterThan(0);
});
