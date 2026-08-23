# Go-live checklist — before the first real hotel

Everything that must be true before a paying property runs its business on Revio. Ordered by what
breaks worst if it is wrong, not by effort.

Demo tenants have been the only users so far, so several items below have never met a real customer.
That is the point of the list: to find out here rather than there.

---

## 🔴 Blockers — a hotel cannot go live until these are done

### 1. Deploy the work that is built and unpushed
Several commits are complete, CI-green locally and **not deployed** (Railway was down 2026-08-23).
Push, confirm CI, confirm the migrations applied, re-run the state audit.

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
`@revio/payments` is Stripe **test mode only**, by design: only a `sk_test_` key selects Stripe, so a
live key cannot move real money by accident. Before a hotel takes a deposit or a no-show charge:
- decide live-mode Stripe and swap the key deliberately,
- **Stripe Connect onboarding per hotel** (each property is paid directly, not through us),
- real card collection needs Stripe Elements — the booking engine has no card fields today.

### 5. Fiscalization (Bulgaria) — a legal gate, not a feature
`TaxInvoice.fiscalRef` + a jurisdiction pack exist; the Bulgarian N-18 integration does not.
A BG property issuing invoices without it is not compliant. See `docs/specs/BG-FISCALIZATION-RESEARCH.md`.

### 6. Channex production certification
Engineering is done and sandbox-verified. What remains is **their** process: a form and a live
screenshare, with external lead time. **Start this early** — it does not shorten by being left late.
Gaps to close first are listed in `BUILD-PLAN.md` (500-day full sync in ≤2 calls, delta-only pushes,
booking acknowledgements, rate-limit compliance).

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

### 12. Scheduler for the background jobs
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

### 18. Operator billing is mocked
Invoices generate and the pricing model is real and tested, but **no payment is taken**. Decide how
hotels actually pay before the first invoice is due.

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
N4 TOTP 2FA · N5 password policy + auth audit + key rotation · operator audit-log screen ·
drop the unused `ProductMapping` table · PMS §2 remainder (auto-assignment writer, drag-to-move,
click-to-manage modal) · P3 in-app assistant.
