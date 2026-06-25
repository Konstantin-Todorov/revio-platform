# App: PMS — Operations (`@revio/pms`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **Phase 3 — not the current build.**

Sold standalone as an operations layer, even over a foreign reservation system. Reads/writes inventory
only through `@revio/core`.

## Scope (when we build it)
- **Front desk** — check-in/out, guest profiles, payments, bills.
- **Housekeeping** — room statuses (Clean / Dirty / Occupied / Out of Order), task assignment,
  supervisor checks, real-time visibility. **Mobile web (PWA)** for non-reception roles — not native apps.
- **Minibar / consumables** → charges posted to the folio.
- **Maintenance / tasks** (basic).
- **Locks/keys** integration depends on the hotel's access type (cards, mobile, codes).

## Hotels vs hostels
Hotels/apartments sell **rooms**; hostels sell **beds**. The shared "Sellable Unit" abstraction in
`@revio/core` covers both — hostels are not a bolt-on.

## Not now
Do not build during the CM phase. Listed for boundary clarity.
