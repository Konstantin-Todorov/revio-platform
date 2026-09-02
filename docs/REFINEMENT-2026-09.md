# Live-product refinement — September 2026

Three founder documents, received 2026-09-02, covering **RevioCRS**, **RevioLink** and **Revio
Operator**. Source: `Revio Development Docs (5)/(6)/(7).docx`.

This is the tracker. Items are lifted from the docs and ordered by **what costs money or trust
today**, not by document order. Nothing here is done until it is ticked and verified live.

Status: ☐ open · ◐ in progress · ☑ done

---

## The theme, stated once

Across all three documents the founder is describing one fault in three products: **screens that
report health they have not verified.** A green pill over a channel that last synced 65 days ago; a
"Queue empty" subtitle above a queue of 10; `0 Failed Syncs · Clear` on a property where nothing was
attempted; `100%` sync success beside 25 open errors.

That is the same defect this codebase spent 2026-08-31 → 09-01 fixing in the Channex layer — a 401
read as an empty feed, a stored key never tested, 411 consecutive false "success" events. **The
pattern is not a coincidence and should be treated as one class of bug, not eleven.**

⚠️ **A zero from success and a zero from silence must never render the same.** If one line survives
from these documents into the codebase, it should be that one.

---

## P0 — screens that actively mislead (build first)

| | Where | What | Doc |
| --- | --- | --- | --- |
| ☑ | RevioLink Dashboard | "Last Successful Sync: 29d ago" badged **Live** — now derives from recency. Per-channel rows carry a second pill too: "Connected" is the socket, the health pill is whether anything arrived | 6 §2.2 |
| ☑ | RevioLink Dashboard | Subtitle is now derived from the count, with the age of the oldest item | 6 §2.3 |
| ☑ | RevioLink Dashboard | Counts **attempts**, not just failures. Nothing attempted renders "—" and amber, never a green zero | 6 §2.4 |
| ☑ | Operator Platform Health | 100% beside open errors is now qualified on the card; a rate over zero attempts is null, not 100% | 7 §10.1, bug 5 |
| ☑ | Operator Platform Health | Negative numerator fixed **at source** in `sync.ts` (rejections can exceed the update count) | 7 §10.3, bug 4 |
| ☑ | Operator Platform Health | The panel had **no time filter at all** — bounded to 7 days and the window is now in the heading | 7 §10.2 |
| ☐ | Operator Clients | `active` / green regardless of 65 days of no activity — `syncRecencyHealth` now exists to derive it | 7 bug 6, §10.5 |
| ☑ | Operator Platform Health | Unhandled errors dumped as raw stack traces — now a sentence, with the trace behind a disclosure | 7 §10.4, bug 1 |
| ☑ | **RevioLink calendar** | ⚠️ **Live defect found inside that trace**: `Math.max(0, NaN)` is `NaN`, so an unreadable price wrote `priceMinor: NaN` | found 2026-09-02 |
| ☐ | Operator Connectivity | Client shown live on Channex with no production key — **resolved** key not displayed | 7 bug 7 |
| ☐ | RevioCRS Inventory | Rate row shows **"—" for dates that DO have prices** (per-person mode) | 5 §2.4 |

### Shipped 2026-09-02 — `@revio/core/metrics/sync-health.ts` (25 tests)

One tested module now answers "is this working", shared by RevioLink and the Operator console so the
two cannot disagree. Five states, and the two that matter are the ones screens kept collapsing into
green: **`idle`** (never ran — not a fault, and not health) and **`unknown`** (nothing attempted in
the window, so there is nothing to report).

`Last Successful Sync` reads the last **success**, not the last attempt: a channel failing every five
minutes has a very recent attempt and is completely broken.

## P1 — correctness of money and data

| | Where | What | Doc |
| --- | --- | --- | --- |
| ☑ | Operator Billing | Worse than reported: **paid with no number and no `issuedAt`** — settled without ever being issued. State machine now enforced in `@revio/core` (22 tests); the row is corrected | 7 bug 2 |
| ☑ | Operator Billing | **Not three conventions — two facts in one column.** A draft carries NET; VAT is computed at issue. Every amount now labelled `ex. VAT` / `incl. VAT` | 7 §8.2, bug 3 |
| ☑ | Operator Settings | **Already per client** — `decideVat` reads the buyer's country and VAT id and returns domestic / EU reverse charge / EU B2C / outside-EU, refusing to issue when a human must decide. The global rate is the domestic default | 7 §12.2b, bug 10 |
| ☑ | Operator Billing | Tier now **derived from physical rooms** (`Unit`, never `RoomType`). An override needs a **reason** and records who and when — so drift and decision stop looking identical | 7 §8.1 |
| ◐ | Operator Billing | Fiscal requirements: immutability ☑, demo series ☑ (already separate), payment attribution ☑, VAT per client ☑ (engine existed). **Remaining: due dates / aging / dunning, and a generate-invoices preview** | 7 §8.4 |
| ☐ | RevioLink / CRS | The two products **disagree about the same room** | 6 §3.0 |
| ☐ | RevioLink / CRS | Bulk copy contradicts the screen; the two disagree on the data model | 6 §4.2 |

### Shipped 2026-09-02 — `@revio/core/invoicing/invoice-state.ts` (22 tests)

Revio is the legal issuer with a gapless series, so these are rules and not presentation: **an issued
document is immutable**, **only an issued document can be paid**, and **nothing returns to draft**.
`setInvoiceStatus` accepted any status from any status with no attribution; it now asks the same
pure function the screen asks, and records **who** settled an invoice, **when**, and **against what**.

**Two of §8.4's three concerns were already built** — checked rather than assumed:

- **Demo numbering is already structurally separate.** `OperatorInvoiceSeries` is keyed by `kind`
  (`demo` | `real`) with independent counters and independent formatters. Live proof: only the
  `demo` counter exists, at 4 — **no production number has ever been drawn.**
- **VAT is already per client.** `decideVat` takes the buyer's country and VAT id and returns
  domestic / EU reverse charge / EU B2C / outside-EU, refusing to issue when it needs a human. The
  global rate is the domestic default, not the answer.

⚠️ **The real gap was data, not code: both real clients have NO billing details at all** — no legal
name, no country, no VAT id — so neither can be invoiced, and nothing said so until somebody tried.
The Billing screen now names them and what each is missing. **Still needs a person to type them.**

Still open from §8.4: **plan tier derived from room count** with an explicit, reasoned override
(today a dropdown, so the console manufactures the drift it then measures).

### Shipped 2026-09-02 — the stack trace, and the live defect inside it

⚠️ **The fault buried in that trace was real and is now fixed.** The console was rendering a raw
Prisma dump; reading it found `priceMinor: NaN` reaching the database from the RevioLink calendar.

The cause is one line, and it is worth remembering: **`Math.max(0, NaN)` is `NaN`, not `0`.**

```ts
Math.max(0, Math.round(parseFloat(input.value) * 100))   // ← "" gives NaN all the way through
```

An empty or non-numeric cell produced `NaN`, `Math.max` did **not** clamp it, and the write reached
Prisma. Guarded explicitly rather than clamped: a price nobody can read is **not zero** — zero is a
real price meaning "free", and silently writing it would be worse than the crash. The bulk path had
the same hole.

`summariseFault` (11 tests) turns the dump into "A rate price was saved with a value that isn't a
number, on /calendar", badges whether it is **our defect** or the environment's, and keeps the raw
trace behind the existing disclosure. Support can triage a client and a screen; nobody can triage a
Prisma invocation.

## P2 — OBP completion (the largest single body of work)

⚠️ **Read 5 §2.1 before touching this.** The founder has **adopted the shipped model over the locked
spec** — no Flat/Derived/Custom modes; two models (`per_room` / `per_person`) and an **occupancy
ladder** that is always materialised into explicit per-occupancy prices.

⚠️ **Vocabulary is locked:** rate plans are *derived*; guest-count prices come from a *ladder*.
**Never reuse "derived" for occupancy.**

| | What | Doc |
| --- | --- | --- |
| ☐ | **Main guest count is a core schema addition and does not exist yet** — everything else depends on it, build first | 5 §2.2 |
| ☐ | Ladder as a persistent room-type rule, re-applied and re-pushed when the main price changes | 5 §2.1 |
| ☐ | Off-ladder overrides marked, never silently recomputed | 5 §2.1 |
| ☐ | Calendar: **one Rate sub-row per guest count, always visible** — no hover, no expand (rate-checking is a scanning task) | 5 §2.4.1 |
| ☐ | Unpriced level renders in amber, never blank | 5 §2.4.2 |
| ☐ | Flag inversions (3p ≤ 2p) — a class of pricing bug now detectable | 5 §2.4.3 |
| ☐ | Compress the availability block; row-visibility control; sticky labels | 5 §2.4.4 |
| ☐ | "See what will change" is a placeholder — must state counts, and warn that it is a **distribution event** | 5 §2.3 |
| ☐ | **OTAs derive occupancy on their side** — model their ladder rather than fight it | 6 §0 |

## P3 — structure and features

| | What | Doc |
| --- | --- | --- |
| ☐ | Operator: **client detail page is the missing spine** | 7 §2 |
| ☐ | Operator: case log / CRM requirement | 7 §3 |
| ☐ | Operator: console reorganisation + build order | 7 §14 |
| ☐ | RevioLink: channel control — the two-stage mapping problem, three intents | 6 §5 |
| ☐ | CRS Dashboard: hero trend renders empty on load — dual-axis occupancy + revenue | 5 §1.2 |
| ☐ | CRS Dashboard: source mix as composition + cost of distribution | 5 §1.3 |
| ☐ | CRS Analytics: availability date range hardcoded | 5 §4.1 |
| ☐ | Activity log: grouping, filters, retention/export | 5 §3 |
| ☐ | Operator: 2FA not enabled on an account that reads every hotel | 7 bug 9 |
| ☐ | Operator: auth log raises nothing on failed sign-ins from unknown addresses | 7 §12.1, bug 11 |

---

## My own concerns, added to theirs (verified 2026-09-02)

Not from the documents. Found while verifying the live platform.

- ⚠️ **`Ethno Villa Cherry` is broken in production.** Our channel row points at Channex property
  `d633e271…` which returns **404**, while **two** properties named "Ethno Villa Cherry" exist
  (`3987f78c…`, `7eb14a83…`). 7 failed syncs, 14 unresolved errors. **Needs a human to choose which
  duplicate survives** — I will not guess which holds the real mappings.
- ⚠️ **Adding a room type or rate plan after onboarding never reaches Channex.** Provisioning is
  one-shot and is the only code that creates them. This is what the first hotel actually hit and it
  is still open. **Highest-value item not in any of the three documents.**
- **Two onboarding paths still exist** — the in-app button and `scripts/channex-onboard.ts`, which is
  what `ONBOARDING-A-HOTEL.md` tells people to run. Both are now guarded, but one should probably go.
- **A per-tenant Channex key is still stored for `Ventsi Group`**, byte-identical to the platform key,
  created by the old provisioning copy-bug. Harmless today, a trap the day the platform key rotates.
- **105 silent early-returns** remain behind the `silent-lint` ratchet.
- **Hotel Sofia — Plovdiv has 25 unresolved `update_rejected` errors** (demo tenant, mock channels) —
  worth confirming they are demo noise and not a real mapping fault before the next onboarding.

## Health at the time of writing

All five services **200**. `pnpm verify` clean: 0 lint errors (24 warnings, budget 25), copy-lint
clean, 219/235 actions gated, silent-lint at budget, full test suite passing. `Chervena Vila` —
provisioned after the fixes — is **healthy**: property resolves 200, zero unresolved errors.
