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
| ☐ | RevioLink Dashboard | "Last Successful Sync: 29d ago" badged **Live**, green. Status must derive from **recency**, not socket state — green ≤24h · amber 1–7d · red >7d | 6 §2.2 |
| ☐ | RevioLink Dashboard | "10 Pending Updates" subtitled "Queue empty — all delivered". Subtitle must be **derived from the number**, plus age of oldest pending | 6 §2.3 |
| ☐ | RevioLink Dashboard | `0 Failed Syncs · Clear` when **nothing was attempted**. Must say "No syncs attempted in 24h", neutral/amber, never green | 6 §2.4 |
| ☐ | Operator Platform Health | 100% sync success shown beside 25 open errors | 7 §10.1, bug 5 |
| ☐ | Operator Platform Health | `Pushed -56/56 updates` — negative numerator | 7 §10.3, bug 4 |
| ☐ | Operator Platform Health | "Recent sync failures" is mostly not failures | 7 §10.2 |
| ☐ | Operator Clients | `active` / green regardless of 65 days of no activity | 7 bug 6 |
| ☐ | Operator Connectivity | Client shown live on Channex with no production key — **resolved** key not displayed | 7 bug 7 |
| ☐ | RevioCRS Inventory | Rate row shows **"—" for dates that DO have prices** (per-person mode) | 5 §2.4 |

## P1 — correctness of money and data

| | Where | What | Doc |
| --- | --- | --- | --- |
| ☐ | Operator Billing | DRAFT invoice marked paid (Hotel Sofia 2026-07) | 7 bug 2 |
| ☐ | Operator Billing | Three invoices, three pricing conventions — VAT applied inconsistently | 7 §8.2, bug 3 |
| ☐ | Operator Settings | One global VAT rate cannot express reverse charge or non-EU — likely cause of the above | 7 §12.2b, bug 10 |
| ☐ | Operator Billing | Plan tier is a dropdown — that IS the tier drift | 7 §8.1 |
| ☐ | Operator Billing | Revio issues real fiscal documents — changes what this screen is | 7 §8.4 |
| ☐ | RevioLink / CRS | The two products **disagree about the same room** | 6 §3.0 |
| ☐ | RevioLink / CRS | Bulk copy contradicts the screen; the two disagree on the data model | 6 §4.2 |

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
