# Has the operator console kept up? — review, 2026-09-07

The console was last worked on properly in **phase L (2026-08-05)**. Since then the platform gained
RevioDirect in production, the waitlist, the cron scheduler, guest feedback (built then held), and a
great deal of hardening. This asks one question: **can we still run the business from this console?**

Answer: **mostly yes, with one hole that costs money and two that cost time.**

---

## 🔴 1. The 2% RevioDirect fee is computed, shown, and never invoiced

The pricing model has four components. Invoicing implements three.

- `directBookingFeeMinor()` exists, is tested, and is called in exactly one place: the Overview's
  usage panel, where it is *displayed*.
- `invoiceLines(plan, ent)` takes **no usage argument at all**.
- `generateInvoices` computes `amountMinor = monthlyPriceMinor(t.plan, ent)` — plan and entitlements
  only.

So a hotel taking direct bookings is billed the platform fee and the module fees, and nothing for the
bookings our engine produced. Costing **€0 today**, because direct revenue is all on demo tenants —
and silently under-billing from the day the first live hotel switches its booking page on.

This is the same shape as the finding phase L was built to catch, running the other way: the console
measures something it does not charge for.

**Fix:** `invoiceLines` and `generateInvoices` take the period's direct revenue, and the invoice
carries a usage line. It must be a *line*, not folded into the total — a finance team reconciles what
they think they bought, and "2% on €4,120 of direct bookings" is checkable where a larger number is a
thing to query by email.

---

## 🟠 2. Platform Health cannot tell you whether the scheduled jobs ran

The dead-man's switch exists at `operator /api/health/jobs` and is polled by a GitHub workflow. The
**screen** shows sync health and application faults, and about the jobs it says only that a workflow
"also verifies the scheduled jobs are still running".

This week `waitlist-sweep` sat at **`never`** for two days — declared, deployed, and invoked by
nothing. A person opening Platform Health would not have seen it, because the one surface that knew
is machine-readable and lives outside the console.

**Fix:** render the endpoint's own answer on the screen. It is a read of a table the console already
connects to, and it is the difference between the check existing and somebody noticing.

---

## 🟠 3. No visibility into RevioDirect at all

`CLAUDE.md` still records "any Operator visibility into the booking engine" as deliberately not
built. That decision was correct when the engine was local-only. It is now live, taking real
bookings, and — see §1 — meant to be billed on.

Today the client page shows a link if the engine is switched on. It does not show whether anyone
books through it, what it earned, or what commission it avoided — even though `channelEconomics`
already computes the last of those and the hotel can see it on their own screen.

**Fix:** a direct-bookings block on the client page: bookings, revenue, the usage fee it generates,
and commission avoided. All four numbers already exist; none is displayed.

---

## 🟡 4. Nothing for a trial, and nothing for support

Both are agreed work rather than review findings, recorded here so the gap list is complete:

- **Trials** — no `trialEndsAt`, no expiry, no reminder mail, no "trialling" state on a client row.
- **Support** — no incident record, no way to see what a client has reported, no contact route from
  the console into a conversation.

---

## ✅ What has kept up

- **Waitlist recovery** is on the client page, computed by the same function the hotel's own screen
  uses.
- **Entitlement changes** are gated, audited into the hotel's own log, and emailed to the owner
  (2026-09-07 — before that they were a silent boolean).
- **Attention, opportunities, tier drift, plan adoption and renewals** all still hold.
- **Demo separation** still holds: money excludes demo, operations include it.

---

## Suggested order

1. **§1 — the usage fee.** Money, and it becomes wrong the day a live hotel switches the engine on.
2. **Support basics.** Needed on day one of a live hotel.
3. **Trials**, properly: state, expiry, automation, mail.
4. **§2 — jobs on Platform Health.** Cheap.
5. **§3 — RevioDirect visibility.** Best done alongside §1, since it is the same four numbers.
