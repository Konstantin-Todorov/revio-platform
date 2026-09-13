# Codex → Claude: website support, signup and icon follow-up

Date: 2026-09-13. This is coordination, not permission to overwrite current work.

## Split remains unchanged

- Codex: sibling `revio-websites`, marketing copy/navigation/forms/icons.
- Claude: platform signup, identity, central login, entitlements, billing and tenant support.
- No separate marketing accounts, email-to-product lookup or new signup backend.
- Documentation implementation remains with its current owner.

## Website implementation

1. Dedicated `/api/support` and `/support` form: name, reply email, property,
   product, impact, subject, message. No attachments, no guest data requested.
2. Uses existing Resend configuration. Recipient resolution is `SUPPORT_INBOX`,
   then `CONTACT_INBOX`, then `office@reviosoft.app`; deliberately no new unverified
   mailbox requirement. Existing public support email remains available.
3. Website support is email, NOT an operator lead or authenticated tenant ticket.
   The form says this explicitly. Existing `/api/contact` and lead ingest are untouched.
4. Server-side bounds/field validation, public-origin check (proxy-safe), honeypot,
   bounded process-local hourly limits, provider idempotency, non-PII error logs,
   partial-success receipt handling. Shared limiter storage/challenge required before
   scaling beyond one replica or making stronger anti-abuse claims.
5. Invite guide corrected from the wrong 48 hours to `TOKEN_POLICY.invite`'s 7 days.
   Cross-repo constant cannot be imported into this standalone site; review copy
   whenever policy changes. Better future option: build-time public policy manifest.
6. Phosphor core 2.1.1 SVG assets replace hand-drawn menu icons. Only selected SVGs
   are built into HTML; no icon font, CDN, runtime library or application icon change.

## Please check on the platform side

### Public pricing wording — confirmed discrepancy

Live signup says “commission-free” twice: signup intro and RevioCRS option.
Marketing states a 2% RevioDirect fee, matching the existing pricing model.
Review `app/signup/page.tsx` and `components/auth/SignupForm.tsx` in channel-manager.
Prefer “your own branded booking page” unless the founder changed the pricing policy.
Do not silently change the fee to make the sentence true.

### Account discovery — source discrepancy to review, not a reproduced attack

The comment in `lib/actions-signup.ts` and parts of the signup brief say existing and
new emails get indistinguishable responses. Current code redirects existing finished
accounts to `/signup/existing?reason=...`, and the public brief describes that result.
Decide explicitly whether that leaks account status contrary to the intended policy.
Do not break resend or no-second-trial protections while addressing it.

### Trial lifecycle and central login

Keep the agreed one identity / three products architecture. Confirm the exact post-trial
experience and interaction with assisted-onboarding first-sync billing before the website
publishes a single promise about day 31. Include ended trial, suspended account and
missing entitlement states in the central-login acceptance checks.

## Testing boundaries

- 11 support handler tests with injected mock mail transport: invalid fields,
  origin/body limits, honeypot, proxy origin, missing config, HTML escaping,
  recipient routing, non-echo receipt, dedupe, send failure, receipt failure,
  stable retry key, rate limit.
- Browser: empty form validation/focus; successful synthetic report with local mock
  transport, reference, receipt message and reset; responsive form with no overflow.
- Live signup: empty submit blocked by required fields; product selection works;
  mobile layout checked. No new production tenant, credential or payment created.
- Your 12 Sept work-log records the real signup/email test. That is attributed to you,
  not represented as a repeat test by Codex. Inbox delivery of the new support flow
  still needs one controlled real-message check.

## Separate priority: website dependency maintenance

`npm audit --omit=dev` currently reports 12 findings (1 critical, 7 high, 2 moderate,
2 low), in the existing Astro/transitive stack; Phosphor adds one package and no
transitive dependencies. Do not run `npm audit fix --force` as part of app work.

Critical advisory: https://github.com/advisories/GHSA-26w7-cxv4-gfx2 — untrusted AVIF
processing in Sharp; Astro fix listed as 7.2.8 / Sharp 0.35.4. Current marketing images
are trusted repository PNGs converted at build, and the new form accepts no uploads.
That narrows this path, but is NOT a completed exploitability audit or an all-clear.
Codex should handle a dedicated website dependency upgrade/regression pass; this does
not require Claude to stop current hotel-app work.

## Release record

Founder follow-up: Documentation now belongs in the marketing Resources menu and Help &
support cards, as well as the footer. This supersedes Documentation's earlier footer-only
placement; Security remains footer-only. Marketing owns these links. Phosphor is the
proposed icon family for docs too, but docs-preview is plain JS/CSS and currently in flight:
coordinate an SVG adaptation with its owner before editing it. Operator/customer-app icon
changes are deferred, not authorized as part of this website release.

Read sibling `revio-websites/docs/WORK-LOG.md` for exact website commit/deployment status.
This platform handoff is intentionally uncommitted; no platform source files were changed.
