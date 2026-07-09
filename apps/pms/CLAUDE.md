# App: PMS — Operations (`@revio/pms`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **V1 COMPLETE — all 5 phases built,
> tested, live (2026-07-05).** **Canonical spec: `docs/PMS-REFERENCE.md`** (founder-confirmed V1 scope).
> **LIVE: https://pms-production-a64b.up.railway.app** (port 3003, cookie `revio_pms_session`, `hasPms`
> gate). **Phases 1-5 DONE — RevioPMS V1 COMPLETE, live** (Units & Housekeeping · Front Desk check-in/out/move/walk-in ·
> Folio & Billing with labels-only payments + a check-out balance gate · Minibar/POS catalog + tap-to-post
> to the folio · Maintenance task board + manual Close Day night-audit). Next: Channex production cert
> (process), then RLS prod-enforcement flip (LAST, covers all products). Gotchas: the RLS proxy `lib/db.ts` forwards `prisma.<model>.<op>`
> ONLY (no `$transaction`); the preview harness drops the session cookie on server-action POSTs (verify via
> minted-cookie curl — GET link-clicks keep it); after a migration RESTART `next dev` + `rm -rf .next` so it
> loads the regenerated Prisma client; re-mint the session cookie after any re-seed (User ids change).

> **V2 overhaul in flight (founder spec 2026-07-09: `docs/specs/PMS-GUIDE-V1.md` — read it before
> changing any PMS screen; Keep sections are binding).** Headlines: nav regroups into Front Office /
> Rooms & Housekeeping / Setup / End of Day; new screens — unified **Reservation view**, operational
> **Guests** profile, **User Management**, **Configuration**; housekeeping gets in-progress + smart
> routing + the one-room-in-progress rule + inspection gate + a scoped mobile role; **every folio
> charge must go through ONE charge-posting service** (outlet + tax tags — the required architecture,
> §1.7); split folios; deposits are **liabilities** (held default vs applied per type); a
> jurisdiction-agnostic **Invoicing module** (gapless series, tax-per-rate); three integration
> boundaries — payment gateway (mock + Stripe test-mode), external POS (via the posting service),
> fiscalization/e-invoicing (Bulgaria N-18 = go-live blocker for real properties). Task phases
> D (operations) + E (money) + F (assignment/seams) in the tracker.

Sold standalone as an operations layer, even over a foreign reservation system. Reads/writes inventory
**only** through `@revio/core` — never ad-hoc queries against inventory tables.

## What it owns (vs CM/CRS)
- **CM** = ARI syncing · **CRS** = the reservation record + metrics · **PMS** = running the property today.
- The PMS realizes the CRS lifecycle states marked *"future — needs PMS connection"* (Checked-in/out).

## The one new concept: physical **Units**
CM/CRS manage inventory as **counts per room type**; the PMS is the first product that cares **which**
room (to clean/key/bill it). It adds a `Unit` (room, or bed for hostels — `unitKind`), and hangs
housekeeping, room assignment, and folios off it **without changing the availability math**. Marking a
Unit **Out-of-Order** writes a CRS `RoomInventoryPeriod` → the shared **waterfall** → one room off sale on
every OTA on the next CM push. That OOO write is the ONE thing that leaves the PMS.

## V1 scope (see `docs/PMS-REFERENCE.md` for the full spec + settled §0 decisions)
- **Front desk** — arrivals/departures/in-house, check-in (room assignment) / check-out / walk-in / room move.
- **Housekeeping** — Clean/Dirty/Inspected/OOO per Unit, task board, supervisor check. **Mobile web (PWA)**
  for non-reception roles — not native apps.
- **Folio & billing** — one folio per stay; post/void charges; **payments = labels + amounts only** (no
  card data, no gateway — matches CRS + the platform card-data rule); balance; settle-at-check-out gate.
- **Minibar / consumables** → charges posted to the folio (mobile quick-post).
- **Maintenance / tasks** (basic) → a unit task may set the Unit OOO.
- **Day close** = a **manual** "Close Day" action (post night's room charge, flag no-shows, roll business
  date in property TZ). Locks/keys = label/placeholder only (hardware integration is future).

## Hotels vs hostels
Hotels/apartments sell **rooms**; hostels sell **beds**. The `Unit` abstraction (`unitKind: room | bed`)
covers both — hostels are a later config flag, **built rooms-first** in V1, not a bolt-on rewrite.

## Platform fit
Fourth Next app (port **3003**, cookie `revio_pms_session`), same shell/auth/session choke point + Railway
service pattern; `hasPms` entitlement gates it (Operator toggle). Adds only **6 tables** (Unit, UnitStatus,
RoomAssignment, Folio/FolioLine, PosItem, tasks) — all `tenantId` + `tenant_isolation` RLS. Metrics stay in
the CRS `@revio/core` formula sheet; per-OTA config stays in the CM. **RLS prod-enforcement stays LAST**
(one pass covers every product's tables).
