# App: Reservation System / CRS (`@revio/reservation`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **Phase 2 — not the current build.**

Sold standalone to small properties that don't need OTAs. Reads/writes inventory only through `@revio/core`.

## Scope (when we build it)
- **Booking Engine** — direct reservations on the hotel's own site; shows availability, computes final
  price, collects guest data.
- **Payments** — Stripe / myPOS / SumUp / VivaWallet; deposits, prepayments. Card data goes through the
  PSP via tokenization; **never stored in our DB**.
- **Folio** — guest account: services, minibar charges, fees → invoicing.
- **Guests** — profiles (GDPR: retention, right-to-erasure, processor agreement).
- **Reports** — occupancy, RevPAR, Revenue, ADR, costs, add-ons.
- **Import** from a hotel's previous system at onboarding.
- **Connector to foreign Channel Managers** (works without our CM).

## Not now
Do not build any of this during the CM phase. Listed here so the boundary and shared-core contract are
clear from day one.
