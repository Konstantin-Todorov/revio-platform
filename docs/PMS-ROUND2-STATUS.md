# RevioPMS — Live-Product Refinement Round 2: build status

Working tracker for the founder's round-2 spec (checkout state machine · reservations calendar ·
Close Day auto-close). **Read this before picking the work up** — it is written to be resumable by
someone, or something, with no memory of the session that started it.

Spec sections referenced as §1 / §2 / §3 are the founder's round-2 document.

---

## The bug, and what it actually was

A reservation (Ventsi Mukov, room 407, €513) read as *closed and open, settled and owing* at once:
folios all `closed`, "Overstayed 41 nights", a €513 balance in the **Open** folios list, breakfast
charges dated nine days after its own departure, and no action that resolved any of it.

**The spec's diagnosis was that check-out is a partial commit. Reading the production rows showed
something different, and the distinction changes the fix:**

| Room | assignment status | checkedInAt | checkedOutAt |
| --- | --- | --- | --- |
| 404 | active | 06 Jul 12:58 | **21 Jul 14:18** |
| 408 | moved | **21 Jul 22:00** | null |
| 407 | active | **21 Jul 22:00** | null |

The 14:18 check-out was **correct** — it stamped 404 and closed the folios. Eight hours later the
same reservation was **checked in again**, and `checkIn` never asked whether the stay had already
departed. Two live assignment rows on a departed stay; and because "in the house" was derived by
folding over assignment rows in three separate files, the guest was back among the occupants —
overstaying one more night every night, accruing a room charge and a breakfast every night, onto a
folio that was already closed.

**Fixing only check-out atomicity, as specced, would not have repaired this record.** The missing
guard was on check-in. Atomicity still had to be fixed — it was genuinely absent — but it was the
second fault, not the first.

Blast radius, measured rather than assumed: **one reservation, on a demo tenant** (`Tenant.isDemo`).
No real client data was affected, which is why nothing was hot-patched.

---

## Done and live

All five commits are on `main`, CI green, deployed to all six Railway services.

| Commit | What |
| --- | --- |
| `2997152` | **§0** `withTenantTransaction` / `withSystemTransaction` in `@revio/db` |
| `c9a69cf` | **§1.3-A/B** atomic check-out · `Reservation.departedAt` · check-in guard · `reopenStay` · accrual stopped · `deriveStayState` in `@revio/core` |
| `8dc4fe6` | RLS enabled on `AuthToken` · `JobLease` · `LoginAttempt` |
| `2ed0920` | **§1.4** `resolveFolio` · **§1.6** `removeFolio` · authz coverage extended to RevioPMS + the ten setup writes gated |
| `7729cb1` | **§1 UI** — resolution panel, receivables tab, remove-split button, departed check-in screen, Reopen stay; plus two more instances of the original fault (`stayState`, resolution folio targeting) |

**§1 AND §3 ARE COMPLETE; §2 IS PARTIALLY BUILT** (see below).

**§1 details.** Verified in the browser against a real database, whole lifecycle: check in →
override check-out → closed-outstanding → leaves Open, appears in Receivables → mark paid
off-system → clears, with `outcome`, note, actor, timestamp and an audit row at every step. Then
verified again on production after deploy: all six services healthy, login works, the new tab and
panel render.

### §0 — the blocker before the blocker

§1.3-A asks for one atomic transaction. **That was impossible on the data layer as it stood.** The
RLS proxy (`apps/*/lib/db.ts`) forwards `prisma.<model>.<op>` only, and `packages/db/src/rls.ts`
already wraps *every individual operation* in its own transaction, because the `app.tenant_id` GUC
has to be transaction-local for RLS to hold under pooling. So sequential awaits were several
transactions and a failure partway committed the earlier ones.

`withTenantTransaction(tenantId, fn)` sets the GUC as the transaction's first statement and hands the
callback a plain tx client. Proven in `rls-verify`, not asserted: the callback sees none of another
tenant's rows, a cross-tenant INSERT is still refused, and a throw rolls back writes that had already
succeeded.

**Anything with an all-or-nothing requirement must go through it** — §2's drag-to-move and §3's
auto-close included. A run of awaits re-creates this bug through a new surface.

### Deliberate deviation from the spec — read before "fixing" it

§1.3-A says *"Reservation → Departed"*. It is implemented as a separate `Reservation.departedAt`
timestamp, **not** as a `status` value, because `status` is the **CRS's commercial record**: it is
read by the availability waterfall, the CM's ARI pushes, and `SOLD_STATUSES` for every revenue
metric. A departed guest's stay is still sold and still earns. Adding a departed status there would
have risked dropping departed stays out of revenue reporting and would have crossed the same CRS/PMS
boundary §2.7 is careful to protect.

`departedAt` is authoritative over any assignment row, everywhere.

---

## Open — in build order

### ⚠️ A trap this round set, worth knowing before touching occupancy code

Rooms used to be allocated **at check-in**, which made "has a live assignment" and "is in the
building" the same sentence — and three separate files said the first while meaning the second.
Auto-assignment breaks that equivalence: a booking can hold a room for next Tuesday.

The Front Desk immediately read **4 in-house** when one guest had arrived. `deriveStayState` now
requires `checkedInAt`, so the rule lives in one tested place. **Any new query about occupancy must
ask whether it means "room held" or "guest here" — they are different questions now.**

Three instances found so far, the last one reported by the founder from the minibar screen:
1. Front Desk counted 4 in-house when one guest had arrived.
2. Close Day's "due out and still in", and the Open folios list.
3. `roomMove` carried `checkedInAt: old ?? new Date()` — so **dragging a future booking on the
   calendar silently checked the guest in**, putting them in occupancy, night-audit revenue and the
   minibar's chargeable list. Fixed in `bfcb7f2`; a move changes where somebody is, never whether
   they have arrived.

### §2 remainder

Built and verified locally (commits `ffc20e3`, `98073e3`): the tape chart, the
housekeeping-aware assignment engine, the atomic + pinned move rebuild, cross-type moves with the
booked-vs-accommodated model. **Still open:**

- [x] **Auto-assignment writer (§2.3) — DONE** (`943fff7`). `lib/auto-assign.ts` +
      `POST /api/jobs/assign`, lease-guarded, each placement re-checked inside its own transaction.
      Verified: three invisible future bookings placed with zero double-bookings.
      **Still to add:** the 0–12h best-information re-optimisation pass — today an unpinned
      assignment is left alone once made, which is safe but leaves the "provisional until arrival"
      half of §2.3 unbuilt.
      ⚠️ **It also needs a scheduler.** Nothing calls the route on a timer, so bookings are placed
      only when someone runs it. Same dependency as §3's auto-close — see `GO-LIVE.md` item 12.
- [x] **Drag-to-move (§2.5) — DONE** (`7b6fb30`). Vertical only; the drop submits the same action
      the form uses, so it inherits the transaction, clash check, pinning and CRS boundary.
      ⚠️ Playwright's `dragTo` does not drive HTML5 DnD here — verification is via dispatched
      DragEvents. A literal mouse drag is not covered by automation; worth one manual check.
- [x] **Click-to-manage modal (§2.6) — DONE** (`7e3f0d8`). Opens over the grid, no navigation.
      Deep folio work still opens the folio, deliberately — a second place to post a charge is how
      two screens drift apart.
- [ ] **The 0–12h re-optimisation pass (§2.3).** The only piece of §2 still missing. Auto-assignment
      places a booking once and then leaves it; the spec wants unpinned placements re-examined close
      to arrival, when the house's picture is most accurate. `canReassign` already encodes who may
      be moved.
- [ ] Drag-edge-to-extend is explicitly a fast-follow, NOT this round.

---

## Blocked — needs a human

- [ ] **Repair the stuck stays.** `packages/db/scripts/repair-stuck-stays.sql` is committed,
      idempotent, transactional, and touches **no money line** — whether post-departure charges are
      owed, waived or written off is a manager's decision, which §1.4 now supports. Production writes
      are blocked in the agent sandbox, so run it by hand:
      ```
      psql "$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL)" \
        -f packages/db/scripts/repair-stuck-stays.sql
      ```
      Back up first — `PG_DUMP=/opt/homebrew/opt/postgresql@18/bin/pg_dump ./packages/db/scripts/backup.sh`.
      The server is Postgres 18 and the default client here is 16, which the backup script correctly
      refuses rather than writing an empty dump.

### ⚠️ Re-verified against production 2026-09-05 — the entry above was wrong in two ways

This section previously said the script was "dry-run verified (selects exactly one row)" and that the
one row was Ventsi. A dry run against production says otherwise, and the difference matters before
anybody runs it:

**It selects five rows, not one** — all in **Hotel Sofia Group**, which is a demo tenant:

| Guest | Stay | Recorded departure |
| --- | --- | --- |
| Julia Tan | 23–27 Jun | 2026-07-24 18:16 |
| Sofia Almeida | 25–27 Jun | 2026-07-24 18:16 |
| Emma Hughes | 26–27 Jun | 2026-07-24 18:16 |
| Walin | 2–4 Jul | 2026-07-24 18:17 |
| Antoaneta Dimitrova | 21–24 Jul | 2026-07-24 18:13 |

They are the real symptom — a departure stamped a month after the stay ended is what a re-check-in
leaves behind. **No non-demo tenant has a stuck stay**, which is the reassuring half: the bug never
reached a paying client's data.

**Ventsi is NOT among them, and the script is right to skip him.** He now has **three OPEN folios**,
and the script deliberately excludes any reservation with one — *"an open folio means the stay may
genuinely still be in progress, and this script must never end a stay that is really happening."*
The claim above that his folios "closed before the column existed" is no longer true; something has
reopened them since 2026-08-23. His last check-out stamp is `2026-07-21 14:18:31`, which is the 14:18
the old note referred to, so it was the right record — its state has moved on.

His outstanding balance now reads **€733.00** across three folios (one at €733, two at zero), not the
€513 recorded in August. Worth understanding *why* it moved before resolving it.

⚠️ Also note Ventsi Mukov Mukov is in **Hotel Sofia Group (demo)**. There is a separate, unrelated
real tenant called *Ventsi Group*; the names invite exactly the wrong conclusion, and this file
should not be read as saying a real client is affected.

- [ ] **Decide what Ventsi's three open folios should be** before resolving the charges. The §1.4 UI
      offers four resolutions, but it answers "how does this debt end", not "why is this folio open
      again" — and the second question comes first.

---

## Found along the way (not in the spec)

- **Ten first-run setup writes had no role check at all.** `apps/pms/lib/actions-welcome.ts` — a
  housekeeper could rename the property, change the VAT rate that prints on every invoice, or
  generate rooms, with a crafted POST. Same class as the X2 folio hole. Now manager-only.
- **authz-lint did not scan RevioPMS** — the app where X2 was found. Now included: 113 → **176**
  server actions checked. It had to be taught the PMS's guard spellings (`ctx("cap")`,
  `requireManager()`), which are real gates.
- **Three tables had no RLS at all** (`AuthToken`, `JobLease`, `LoginAttempt`). `rls-verify` had been
  failing on them since they were added and nobody was reading the gate. Now `operator_only`;
  **rls-verify passes 104/104**.
- **`ensureFolio` is a long unwrapped write sequence** (seeds accommodation, taxes, fees). Not yet a
  known bug, but it is the same partial-commit shape §0 exists to fix. Worth moving onto
  `withTenantTransaction`.
- **Duplicated surnames in `guestName`** — "Ventsi Mukov Mukov", "Hugh Reyes Reyes". Cosmetic, looks
  like a name-concatenation bug where a guest record and a raw `guestName` are joined. Unexamined.
- **A cancelled reservation holds an open folio** (a second "Hugh Reyes"). Confirmed on the live
  Folios → Open list 2026-08-23: it shows as a live bill at €393 for room 110, on a reservation whose
  status is `cancelled`. A cancelled stay should not carry an open bill, and it certainly should not
  appear among in-house guests. Same family as §1 — a state change that leaves a related record
  behind — and the obvious next fix after the repair.
- **"Hugh Reyes Reyes" is genuinely overstayed** (room 208, €484, never checked out). Unlike Ventsi
  this is not the bug: nothing checked it out, so the exception strip flagging it is correct
  behaviour. It is what §3's auto-close and §1.3-C's force-resolve are for.

---

## The state audit — run this, don't wait to be told

`packages/db/scripts/state-audit.sql` (read-only, safe on production) lists every record currently
in a contradictory state, with the remedy for each. It exists because the round-2 bug was found by a
hotelier rather than by us, and the principle it established — **no record may exist in a state with
no available action** — is a claim about the whole database that nothing was checking.

```
psql "$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL)" \
  -f packages/db/scripts/state-audit.sql
```

Zero rows on every line is healthy. Production, 2026-08-23:

| Fault | Rows | Note |
| --- | --- | --- |
| closed folio with no recorded outcome | 12 → **0** | fixed by migration `20260823140000_backfill_folio_outcome` |
| genuinely overstayed | 6 | real operational debt, not corruption — the desk must act, or §3 auto-close will |
| charge posted after the folio closed | 4 | the round-2 stay's post-departure breakfasts |
| cancelled reservation still occupying a room | 1 | the €393 room-110 row; cancelling is now refused, this row predates it |
| stay with folios closed but rooms never released | 1 | the round-2 stay — needs `repair-stuck-stays.sql` |
| room double-assigned over overlapping nights | 0 | ✓ |

Worth running before every release, and it is the natural home for the next integrity rule anyone
thinks of.

## Before the first real hotel

`docs/GO-LIVE.md` is the checklist — blockers, strongly-recommended, and what is already done so
nobody redoes it. Read it before promising a customer a date.

## Working agreement

- Edit here, commit, push to `main`. That does **not** deploy: CI runs on `main`, and only a green run
  fast-forwards `production`, which is the branch the services actually watch. Roughly one CI cycle of
  delay before anything goes live, which is the point of it. See DEPLOY.md, *The CI gate*.
- **Before pushing:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (what CI runs), plus
  `pnpm --filter @revio/db rls-verify` against a restricted role when touching data access.
- The pre-push hook backs production up automatically when a push carries migrations, and **fails
  closed** if the backup fails.
- Standing constraints: payments stay mocked / Stripe **test-mode only**; never store a card number;
  never call `forSystem()` in a user-facing request path; demo tenants stay out of money metrics.

---

## ☑ Fixed 2026-09-05 — found while auditing concurrency

**The manual Close Day button takes no job lease; the auto-close cron does.**

`/api/jobs/closeday` leases `JOB.autoCloseDay` and explains why: *"two closes would roll the business
date twice and skip a day entirely."* `closeDay()` in `apps/pms/lib/actions-closeday.ts` reaches the
same `runCloseDay` with nothing.

Verified rather than assumed: two **concurrent** runs cannot skip a day. Both read `businessDate = D`
before the transaction and both compute `next` from that read, so both write `D+1`. What they do
produce is a duplicated close — `candidates` was read before either transaction, so the same
reservations are marked no-show twice and counted twice, and two audit entries claim the same close.

**Fixed** by making the roll optimistic rather than adding a lease —

```ts
await tx.property.updateMany({
  where: { id: propertyId, businessDate: property.businessDate },  // still what we read
  data: { businessDate: utcDay(next), ... },
});
```

A lease only serialises runs that overlap in time; the condition also refuses the *sequential*
double-close, which is the one that actually could skip a day.

The refusal throws `DayAlreadyClosedError`, which aborts the transaction so the no-show updates roll
back with it. The manual button says "that day had just been closed automatically" rather than
redirecting silently, and the cron counts it as skipped and continues the sweep.
