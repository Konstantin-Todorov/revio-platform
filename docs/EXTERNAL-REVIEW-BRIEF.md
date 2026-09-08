# Brief for an external reviewer (Codex, or any second pair of eyes)

Copy the block under **The prompt** into the reviewing agent. Everything above and below it is
context for the person doing the copying.

**Why this exists:** the platform is finished and about to meet its first paying hotel. A second
reader is worth more now than at any point since it was written — and a reviewer who *changes* things
unsupervised is worth much less than one who reads carefully and reports.

---

## The prompt

> You are reviewing **Revio**, a live hotel-software platform: five Next.js apps (RevioLink,
> RevioCRS, RevioPMS, RevioDirect, and an internal operator console) on one shared Postgres, in a
> pnpm monorepo. It is deployed and serving. Its first paying customer has not arrived yet, and the
> goal of this review is that nothing embarrassing happens when they do.
>
> **Read these first, in this order. Do not skip them — they will change what you think the bugs are:**
> 1. `CLAUDE.md` — the architecture and the rules that govern it, including a UI bar every screen is
>    held to and four Channex traps that have each cost a day.
> 2. `docs/STATUS.md` — the single source of truth for what is done. Every other document may be
>    stale; this one names how each claim was checked.
> 3. `docs/GAP-REGISTER.md` — 21 classes of defect already found here, each with the guard that now
>    holds it shut. **This is the most useful file in the repository for you.** If you think you have
>    found something, check whether it is a known class first, and whether its guard is still intact.
> 4. `docs/UI-STANDARD.md` — the bar for any screen.
>
> ### Rules — these are hard
>
> - **Do not write to production.** No `psql` against `DATABASE_PUBLIC_URL`, no `railway run`, no
>   `railway variables --set`, no migrations against a live database. Reading production is fine.
> - **Do not push, and do not touch the `production` branch.** `production` is what deploys; a push
>   to it ships. Work locally, commit locally if you must, and let a human push.
> - **Never print, echo, log or copy a secret.** `.env` files, `railway variables` output, anything
>   named `*_KEY`, `*_SECRET`, `*_PASSWORD`, `DATABASE_URL`. If you need to prove a variable exists,
>   print whether the key is present, never its value.
> - **Payments stay mocked.** Stripe is in test mode. Do not add live keys, do not complete a
>   transaction, do not store a card number anywhere.
> - **Do not "fix" style, formatting or dependency versions.** A large diff hides the findings that
>   matter and this repository's conventions are deliberate, including the ones that look unusual.
>
> ### How to run the checks safely
>
> ```bash
> pnpm install
> pnpm --filter @revio/db db:generate
> pnpm verify        # typecheck, lint, ten ratchet lints, 1,797 tests — takes a few minutes
> ```
>
> `pnpm verify` touches no database and no network. If you want a database, create your own local one
> and set BOTH `DATABASE_URL` **and** `DIRECT_DATABASE_URL` — migrations follow the second, so setting
> only the first silently migrates a different database. That has already caught somebody out.
>
> ### What to look for, in priority order
>
> 1. **Anything that loses or corrupts a hotel's money or inventory.** Money is integer minor units
>    everywhere; a float or a `Number()` on form input is a bug. Availability has one source of truth
>    in `packages/core` — a second query against inventory tables anywhere else is the double-booking
>    the whole product exists to prevent.
> 2. **Tenant isolation.** Every tenant table carries `tenantId` with a `tenant_isolation` RLS
>    policy; operator-only tables use `operator_only`. Find any query that could cross tenants, any
>    new table without a policy, any use of the system perimeter (`forSystem`) that should have been
>    tenant-scoped.
> 3. **Authorization.** Server actions are POST endpoints; hiding a button protects nothing.
>    `scripts/authz-lint.mjs` proves each is gated or exempt with a stated reason — check the
>    exemptions are honest, not just present.
> 4. **Anything that reports success it has not verified.** This is the repository's most repeated
>    bug class: a green pill over a dead channel, a job runner trusting a status code while receiving
>    a login page, a monitor enumerating rows instead of a registry. Classes 13, 18, 19, 20 and 21 in
>    the gap register are all this shape. Assume more exist.
> 5. **The first hour of a new customer.** Invitation → password → sign in → the guided setup →
>    adding rooms and rates. A bug here is the one a hotel actually meets. One was found in exactly
>    this path last week and is class 21.
> 6. **Screens.** Empty states, error states, a very long hotel name, a phone, a keyboard. Tailwind
>    silently emits nothing for a class it does not know — `pnpm tokens:lint` covers that specific
>    trap, but not layout.
>
> ### What to hand back
>
> A list, most serious first. For each: **the file and line**, **what breaks**, **the exact input or
> sequence that breaks it**, and **how sure you are**. A concrete failing case is worth more than ten
> observations, and "this looks unconventional" is not a finding — much of this code is deliberately
> unconventional and says why in a comment directly above itself.
>
> If you believe something is wrong and the comment above it argues otherwise, say so explicitly and
> quote the comment. Either the comment is out of date, which is worth knowing, or the reasoning
> answers you, which is also worth knowing.
>
> Do not open pull requests. Do not commit to `main`. Report.

---

## After the review

Treat each finding as a claim to verify, not an instruction. Two of this week's most confident-looking
findings turned out to be wrong on inspection, and one that looked cosmetic was a feature that had
never run in production. Reproduce before fixing.

If a finding turns out to be a **class** rather than an incident, it belongs in
`docs/GAP-REGISTER.md` with a guard — and the guard should be proven to fail before it is trusted.
