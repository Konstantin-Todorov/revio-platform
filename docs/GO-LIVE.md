# Go-live checklist — before the first real hotel

Everything that must be true before a paying property runs its business on Revio. Ordered by what
breaks worst if it is wrong, not by effort.

Demo tenants have been the only users so far, so several items below have never met a real customer.
That is the point of the list: to find out here rather than there.

---

## 🔴 Blockers — a hotel cannot go live until these are done

### 1. ~~Deploy the work that is built and unpushed~~ ✅ done 2026-08-24
Everything is pushed, CI-green and deployed; migrations confirmed applied in production.

### 2. Repair the stuck production records
`packages/db/scripts/state-audit.sql` (read-only, safe on production) lists every contradictory
record. As of 2026-08-23 it found:

| Fault | Rows | Fix |
| --- | --- | --- |
| genuinely overstayed | 6 | front desk: check out or extend — §3 auto-close will also resolve these |
| charge posted after the folio closed | 4 | void the line, or reopen and resolve the folio |
| cancelled reservation still occupying a room | 1 | check the guest out in RevioPMS |
| stay with folios closed and rooms never released | 1 | `packages/db/scripts/repair-stuck-stays.sql` |

Run the audit again after fixing. Zero rows everywhere is the bar.

**As of 2026-08-24 this is no longer a blocker for a first real client**, because all three tenants
in production are demo tenants — the 9 remaining faults are in demo data. It stays on the list at a
lower priority for a different reason: **demo data is what a prospect is shown**, and a demo hotel
with a guest who never checked out is a poor advertisement. Current: 4 post-close charges,
3 overstays, 1 cancelled-but-occupying, 1 settled folio still carrying a balance.

### 3. Plan and usage limits sized for a business, not a side project

**This took production down on 2026-08-23.** The workspace is on Railway's Hobby plan with a
**$15.00 compute cap**; usage reached $14.88 and Railway stopped every service *and the Postgres
container*. It was not a crash, a bad deploy or a payment failure — it was a ceiling, and the whole
platform went dark until someone noticed.

A usage cap that can stop the database is indistinguishable, to a guest standing at a check-in desk,
from the company having gone out of business. Before a real hotel depends on this:
- raise the compute limit well above expected steady-state, or move off Hobby,
- **set the alert threshold below the hard cap** so it warns instead of executing,
- know what the six services actually cost per month at real occupancy, so the cap is a safety net
  against runaway spend rather than a tripwire in normal operation.

Related: item 10 (monitoring). Nothing announced this outage — it was found because a `git push`
failed. That is not a detection mechanism.

### 4. Payments are mocked — no money can actually move
**Decided 2026-08-24: hotels pay us by bank transfer first.** Item 18 is built accordingly — invoices
carry our IBAN and a payment reference, and no card is involved. What remains below is about
GUEST-facing card payments, which are a separate decision and not needed for a first client that
takes cash and bank transfer at the desk.

`@revio/payments` is Stripe **test mode only**, by design: only a `sk_test_` key selects Stripe, so a
live key cannot move real money by accident. Before a hotel takes a deposit or a no-show charge:
- decide live-mode Stripe and swap the key deliberately,
- **Stripe Connect onboarding per hotel** (each property is paid directly, not through us),
- real card collection needs Stripe Elements — the booking engine has no card fields today.

### 5. Fiscalization (Bulgaria) — a legal gate, not a feature
`TaxInvoice.fiscalRef` + a jurisdiction pack exist; the Bulgarian N-18 integration does not.
A BG property issuing invoices without it is not compliant. See `docs/specs/BG-FISCALIZATION-RESEARCH.md`.

### 6. ~~Channex production certification~~ ✅ passed — now WIRE it
Certification is done and the production account exists. That is not the same as a working
production connection. What remains, per hotel:

1. Get the **production API key** from app.channex.io and store it per tenant in the Operator console
   under Connectivity (encrypted at rest), or as `CHANNEX_PROD_KEY` on the channel-manager and jobs
   services as a fallback.
2. Create the hotel's property in Channex and record its UUID on the channel's `externalPropertyId`.
3. Map room types and rate plans both ways.
4. Switch the channel `channex_sandbox` → `channex_prod`.

A channel that is missing the key or the property id now **fails loudly and says which**, rather than
sending an empty auth header and reporting Channex's 401 as though Channex had rejected the hotel
(fixed 2026-08-24). The failure lands in the Sync Center and Error Center like any other.

### 7. A real hotel's OTA credentials
Per-property Channex/OTA keys, stored encrypted via the Operator console. Never point a real adapter
at a demo tenant.

---

## 🟠 Strongly recommended before the first client

### 8. A staging environment
`git push main` currently deploys straight to production, six services, no rehearsal. A second
Railway environment on the same project, seeded with the demo tenants, is the single change that most
reduces the chance of a customer seeing a bad deploy.

### 9. Branch protection on `main`
CI exists and is green, but nothing enforces it — a red CI still deploys. **Note this changes the
workflow**: with required status checks, direct pushes to `main` are rejected and everything goes
through a PR. Worth it before real clients; decide deliberately.

### 10. Error monitoring and uptime alerts
There is none. The app's Sync/Error Center covers OTA failures, not an unhandled exception in
checkout. Today the detection mechanism is a hotel emailing you. Sentry + an uptime ping.

The 2026-08-23 outage is the argument: every service and the database stopped, and nothing told
anyone. An uptime check would have.

### 11. Backups are drilled, not just taken
`docs/RESTORE.md` records a real restore drill (RTO ≈1 min) — good. Re-drill after the next schema
change, and confirm the pre-push hook's backup still works: it **failed closed** on 2026-08-23 when
the DB was unreachable, which is correct, but it means a database outage also blocks deploys.

### 12. ~~Scheduler for the background jobs~~ ✅ done — `jobs` cron service is live
Railway cron runs all six on schedule; last check 6/6 succeeded. Original note kept below.

#### (original)
`api/jobs/*` routes exist and are Bearer-gated, but nothing calls them on a timer. Until a scheduler
runs them, these do not happen:
- **auto Close Day** (§3) — the pile-up prevention only works if the job runs,
- hold expiry, pickup snapshot, scheduled Channex pull, arrival digests.
Railway cron or a worker service. **`/api/jobs/closeday` must be scheduled or §3 is inert.**

### 13. Email deliverability
Resend is live and authenticated for transactional mail (SPF + DKIM + alignment verified on
`send.reviosoft.app`). Two gaps:
- **cPanel DKIM for the SuperHosting mailboxes** — `default._domainkey.reviosoft.app` is empty, so
  human mail from `office@` is unsigned.
- **DMARC is `p=none`** — move to `p=quarantine` *after* the above, not before.
- Verify a real contact-form submission lands in `office@` (never confirmed).

### 14. Server-rendered PDFs, when a document needs SENDING

Invoices, proformas and credit notes print cleanly today: a print stylesheet strips the app shell
and the browser's own "Save as PDF" produces a proper one-page document. That covers a person
downloading or printing one, at no runtime cost.

It does **not** cover attaching a document to an email, or archiving a byte-identical copy — both
need the PDF generated on the server. That means headless Chromium in the container (a large binary
and a memory-hungry process) or a layout library like `@react-pdf/renderer` (lighter, but the
document gets built twice and the two can drift).

Deliberately deferred: the platform has already been taken down once by a compute limit, and this is
the kind of dependency that makes that likelier. Do it when invoices need to be emailed — which is
also roughly when fiscalization (item 5) forces the question anyway.

### 15. Per-hotel sending domains
Guest email currently goes out as Revio. A hotel's confirmation should carry the hotel's brand and
domain, not its vendor's.

---

## 🟡 Operational readiness

### 16. Onboarding a real property end to end, once, on purpose
Provision a tenant, run the welcome flow as the owner, add rooms, connect a channel, take a booking,
check in, post a charge, check out, close the day. Every screen, once, as a customer would. The
demo tenants exist in production precisely so this can be rehearsed against real migrations and real
RLS.

### 17. `book.revio.app` DNS
RevioDirect is live on `booking.reviosoft.app`. It is the only page a *guest* sees, so it should not
sit on a vendor-shaped URL. DNS change plus `BOOKING_ENGINE_ORIGIN` on the `reservation` service.

### 18. Operator billing — ✅ invoicing built 2026-08-24; payment stays manual by design
A draft can now be **issued** as a real document: gapless number (`REV-2026-0001`), our legal identity
and the client's snapshotted at issue, VAT decided per customer (domestic · EU reverse charge ·
outside scope), bank details and a payment reference, printable to PDF.

Before the first invoice goes out:
- **Fill in Settings › Company** — legal name, VAT number, EIK, registered address, IBAN/BIC. Nothing
  can be issued until this exists, deliberately.
- **Fill in each client's Billing details** on their client page. Their *legal* entity, not their
  trading name, and their country — which is what decides the VAT treatment.
- **Have an accountant confirm the VAT treatment** against our actual registrations. The rules
  implemented are the ordinary ones for B2B electronically supplied services under Directive
  2006/112/EC, and `apps/operator/lib/vat.ts` states each branch and its legal note.
- **Confirm that list prices exclude VAT.** `pricing.ts` never said either way; net is the reading
  taken everywhere, and the opposite reading changes every invoice by 20%.

No payment is taken and none is planned for now — hotels pay by bank transfer against the IBAN on the
invoice, and marking one paid is a human confirming the money arrived.

### 19. Support and incident basics
Who a hotel calls at 23:00 when check-in fails; where errors surface; how a bad deploy is rolled
back (`docs/RESTORE.md` + Railway redeploy of the previous image).

---

## ✅ Already done — do not redo

- **RLS enforced in production** — all services run as the restricted `revio_app` role;
  `rls-verify` passes **104/104** and refuses to run under a role that could bypass policies.
- **Authorization coverage** — 176 server actions, 164 gated, 12 exempt with stated reasons; the
  PMS is in the scan.
- **Atomic multi-step writes** — `withTenantTransaction`, proven to roll back.
- **Backup before every migration** — pre-push hook, fails closed.
- **State-integrity audit** — `state-audit.sql`, ten rules, run it before each release.
- **No card numbers, no image bytes in Postgres** — enforced by convention and reviewed.
- **Login rate limiting, password reset, revocable sessions** (N1·N2·N3).

## Still open, not blocking
Drop the unused `ProductMapping` table · PMS §2 remainder (click-to-manage modal) · P3 in-app
assistant · two indexes exist in migrations but not in `schema.prisma`
(`Folio_propertyId_outcome_idx`, `Reservation_propertyId_departedAt_idx`), so `migrate diff` reports
drift — harmless (they are extra indexes, not missing ones) but it should be reconciled before it
hides a real drift.

## Done since this list was written
**N4** TOTP 2FA on the operator console · **N5** password policy with breach checking, the
authentication audit trail, and key rotation for both `AUTH_SECRET` and `CONNECTIVITY_SECRET`
(previous-key grace window, so rotating either signs nobody out) · the operator **auth-log screen** ·
the **jobs cron service** · **Revio→hotel invoicing** with company identity and VAT.
