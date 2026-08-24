# Spec-08 — decisions taken

Answers to the questions the specs left open, with the reasoning that produced them. Recorded here
because the reasoning is the part that gets lost, and the next person to touch these will need it
more than the answer.

Signed off **2026-08-24**.

---

## L1(a) — the pricing model is CRS-owned and read-only in Link when connected ✅

**Stronger than "the CRS wins on conflict", deliberately.**

A rate-*value* conflict is recoverable: the CRS reasserts a number and the worst case is a stale
price for one sync cycle. A *model* mismatch is structural — if the CRS is per-person and Link flips
to per-room, the occupancy rows stop existing and the ARI data is not stale, it is **incoherent**.
There is nothing to reassert, because the shape the values live in has gone.

So the model is **single-owned, not conflict-resolved**:

- CRS connected → the model toggle in Link is **disabled**, with a "managed by your CRS" note.
  `sell_mode` flows down from the CRS.
- Standalone → Link owns the model outright.

## L1(b) — Link edits are transient, reasserted, and surfaced ✅

Link edits **apply immediately** so Link stays operational; an operator is never blocked. On the
CRS's next authoritative push, any diverging cell (date × plan × occupancy) is overwritten with the
CRS value.

Three requirements, and the third is the one easiest to miss:

1. The override is written to a **visible log/notice** — the user sees *why* their value changed.
   Never a silent revert.
2. Edit-time copy: **"managed by your CRS — may update on the next sync."**
3. **The reassertion must re-push to channels.** Otherwise the CRS and Link agree while the OTA is
   still selling the stale Link value — the parity failure, arrived at from the other direction.

## L1(c) — occupancy capability rides the channel-limitations line ✅

**Not an L1 blocker**, and worth saying why: it lives in the channels/sync layer, not the
foundation. Occupancy support is the same kind of per-channel caveat as "Agoda ignores CTD", so it
folds into the existing limitations line, and the capability flag drives Channex degradation — full
per-occupancy to Booking.com-class channels, primary + extra-guest to single-rate ones. Restyling
that display later cannot force an L1 redo.

**The real L1 blockers were (a) and (b). Both are now answered; L1 is unblocked.**

---

## §4.5 — the guest profile hydrates contact fields ✅ with guardrails

The profile is the canonical record, so it enriches from the most recent linked reservation that has
a value. Three rules:

- **Enrich empty** — fill blanks from the most recent reservation carrying a value.
- **Never overwrite** — a non-empty field has been manually confirmed by a person and outranks
  anything derived.
- **Tag OTA-sourced contact as OTA-provided.** Booking.com and others send a masked relay address:
  fine for messaging, and **not ground truth**. It must be visibly an alias, or a hotel will use it
  believing it reaches the guest directly.

Also powers the §4.2 "Book again" prefill.

---

## Website — "free until your first booking syncs": BUILD it, do not reword ✅

The line is load-bearing across the site, the outreach and the sales flow. Softening it to a generic
trial loses the actual story: *we do not charge until the software has demonstrably worked.*

Not a large lift — the "first successful booking sync" event per property is needed anyway:

- On that event, set `billingStartDate` on the property/tenant.
- **Suppress all invoicing before it.** The free period runs until then.
- **Edge case, and it is correct:** a property that never gets a first booking stays free forever. No
  value delivered, no charge.

**Hard rule: the promise must not be published while billing ignores it.** If the page has to go up
first, the interim line is *"Free setup — we don't start billing until you're live"*, swapped for the
full promise when the trigger ships.

---

## Sequencing ✅

Analytics (D1–D6, D8, D9) → dashboard charts (C1, C2) → guests (F1–F3) → calendar badges (G1, G2) →
bulk-modal restructure (G4–G6) → website → **OBP last**.

All of it is independent of OBP, so front-loading it while OBP stays parked is correct — and doing
OBP last means (c)'s lower risk never reaches the critical path.
