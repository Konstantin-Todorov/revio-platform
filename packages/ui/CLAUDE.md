# Package: UI (`@revio/ui`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first.

Shared design tokens and (later) shared components for all four apps. Tokens are derived from the
**Atlas** design direction in `design/Direction A - Atlas.dc.html`, which is the realized look of the
reference screenshot: navy chrome, blue/green/amber/red status colors, a purple accent.

- `src/tokens.css` — CSS custom properties (the source of truth for color/space/radius).
- `src/tokens.ts` — the same values for TS/Tailwind config consumption.

The user may send a refined palette; it overrides these. Keep all color usage going through tokens —
no hardcoded hex in app code — so a palette swap is one file.
