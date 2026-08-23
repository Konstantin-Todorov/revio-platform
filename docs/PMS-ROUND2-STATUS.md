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

**§1 IS COMPLETE.** Verified in the browser against a real database, whole lifecycle: check in →
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

### §3 — Close Day auto-close

Reuses §1's corrected close transaction, so it lands after §1. Two-stage escalation: reminder at the
close deadline (default 00:30 next day), auto-close after the reminder window (default 22h). An
auto-close is a **real financial close** running the same transaction, marked
`Closed automatically by system`, and it does not block on readiness items — it carries them forward
onto the record. Both timings property-configurable.

### §2 — Reservations calendar + move rebuild

The big one. Tape chart (physical rooms × dates), drag-to-move, click-to-manage modal,
housekeeping-aware auto-assignment with the 0–12h best-information pass, and the booked-vs-accommodated
model (§2.7 — an operational upgrade updates physical occupancy but **never** rewrites the CRS room
type and **never** pushes to channels).

---

## Blocked — needs a human

- [ ] **Repair the stuck production record.** `packages/db/scripts/repair-stuck-stays.sql` is
      committed, idempotent, and dry-run verified (selects exactly one row with the correct 14:18
      departure). It deliberately touches **no money line** — whether the post-departure charges are
      owed, waived or written off is a manager's decision, which §1.4 now supports. Production writes
      are blocked in the agent sandbox, so run it by hand:
      ```
      psql "$(railway variables --service Postgres --json | jq -r .DATABASE_PUBLIC_URL)" \
        -f packages/db/scripts/repair-stuck-stays.sql
      ```
- [ ] **Ventsi's post-departure charges** then need resolving through the §1.4 UI, which now exists:
      open the folio and choose one of the four resolutions.

**Until the repair runs, production still shows the old symptom for that one record** — verified
2026-08-23: Ventsi still appears in Folios → Open at €513, because `departedAt` is still null there.
The code fix is live; the row is what is stale. Its folios also have `outcome = NULL` (they closed
before the column existed), which is why Receivables reads empty rather than showing the debt.

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

## Working agreement

- Edit here, commit, push to `main`; Railway auto-deploys all six services. No staging yet.
- **Before pushing:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (what CI runs), plus
  `pnpm --filter @revio/db rls-verify` against a restricted role when touching data access.
- The pre-push hook backs production up automatically when a push carries migrations, and **fails
  closed** if the backup fails.
- Standing constraints: payments stay mocked / Stripe **test-mode only**; never store a card number;
  never call `forSystem()` in a user-facing request path; demo tenants stay out of money metrics.
