# App: PMS — Operations (`@revio/pms`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. **Now the active build** (started
> 2026-07-04, after RevioCRS V1). **Canonical spec: `docs/PMS-REFERENCE.md`** (founder-confirmed V1 scope).
> **LIVE: https://pms-production-a64b.up.railway.app** (port 3003, cookie `revio_pms_session`, `hasPms`
> gate). **Phase 1 (Units & Housekeeping) + Phase 2 (Front Desk: check-in/out, room move, walk-in) DONE +
> deployed.** Next: Phase 3 (Folio & Billing — labels-only payments). Gotcha: the RLS proxy `lib/db.ts`
> forwards `prisma.<model>.<op>` ONLY (no `$transaction`); the preview harness drops the session cookie on
> server-action POSTs (verify actions via minted-cookie curl instead — GET link-clicks keep the cookie).

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
