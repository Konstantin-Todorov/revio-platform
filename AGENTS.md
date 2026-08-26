# Working on this repo as an agent

**Read `CLAUDE.md` first — it is the architecture and the product.** This file is the operational
half: the rules that cause real damage when broken, and how two agents share one repo without
standing on each other.

Applies to every agent (Codex, Claude Code, anything else). One set of rules, one place.

---

## 1 · The eight things that will actually hurt

Each of these has already gone wrong here at least once. They are not style preferences.

**RLS — `forSystem()` in a user-facing request is a data breach.**
`forTenant(id)` scopes every query to one hotel; `forSystem()` bypasses it and exists for the
operator console, jobs, and resolving a public booking slug. Choosing between them **is** the
security decision, so it belongs at the top of a request, never buried in a data helper. RLS is
enforced in production — every service connects as a restricted role that cannot bypass it.

**Taking inventory is a claim, never a check-then-write.**
```ts
// NEVER. Two guests clicking the last room in the same second both pass.
const remaining = await remainingByNight(...)
if (remaining < qty) return "sold out"
await prisma.hold.create(...)
```
Use `claimHold()` in `@revio/db`. Compute the waterfall for the *message*, claim for the *room*.
`pnpm --filter @revio/db claim-verify` proves the primitive; `engine-race` proves the booking path.

**Money is integer minor units + an ISO currency code.** Never a float, anywhere.

**No card numbers and no image bytes in Postgres.** Cards: gateway token + brand + last4 only, via
`@revio/payments`. Images: keys only, bytes in object storage via `@revio/storage`.

**Multi-step writes need `withTenantTransaction`.** Every op through `forTenant()` is its own
transaction, so sequential `await`s commit partially. Anything all-or-nothing must be wrapped.

**Never import `node:crypto` into the `@revio/db` barrel.** `instrumentation.ts` is bundled for the
edge runtime and webpack follows the dynamic import, so it breaks the operator build. A
`NEXT_RUNTIME` guard does not help. Use the `@revio/db/errors` subpath. This broke the build twice.

**Never interpolate `${{ }}` into a shell script in a GitHub workflow.** A commit message containing
an apostrophe closes the quote and the step dies. Pass through `env:`. This broke twice, in two
repos, the same way.

**Prisma doc comments are `///`, not `/** */`.** The schema will not parse otherwise.

## 2 · Two Channex traps that pass every test and still lose money

**A Channex rate plan belongs to ONE room type.** We model plans at property level. A hotel with 3
room types and one "Standard Rate" needs **three** Channex rate plans — send one and the last write
wins, two room types are mispriced on every OTA, and the Sync Center is green because every call
succeeded. `ChannelRatePlanMapping` is keyed by `(channel, plan, roomType)` for this reason.

**A Channex `HTTP 200 "Success"` can be a rejection.** The refusal is inside `meta.warnings`.
Verified live on production, twice. `extractWarnings` handles it — never add a Channex call that
ignores the warnings array.

## 3 · Deploying — the gate is the point

`main` is where work lands and where CI runs. **`production` is fast-forwarded to `main` only when
CI has gone green on that exact commit**, and Railway watches `production`. A red CI simply leaves
production where it is.

- **Never push to `production` directly.** It is not protected; it is trusted.
- A push that supersedes an in-flight CI cancels it (`cancel-in-progress`). If two pushes land close
  together the first one's CI never finishes — which is fine, but **check that the promote actually
  fired** before telling anyone a change is live. It has been missed once.
- Before claiming something is deployed: `git fetch && git rev-parse origin/production` and compare.

## 4 · Before you commit

```
pnpm -r typecheck && pnpm -r test && pnpm -r lint && pnpm -r build
```
All four, all green. Builds are memory-hungry — if `pnpm -r build` is OOM-killed (exit 137), build
the five apps one at a time.

Commit messages here explain **why**, in prose, and name what was wrong before. They are the design
record; a one-line "fix bug" loses information nothing else captures.

Commit and push **only when the work is done and verified**. Never `--force`.

## 5 · Two agents, one repo

Neither agent can see the other's session. The repo is the only channel, so:

**`docs/WORK-LOG.md` is the shared board.** Before starting anything non-trivial, append a claim.
When you finish, mark it done. Read it before you start — it is how you find out the other agent is
already three commits into the thing you were about to build.

**Pull before you start and before you push.** `git pull --rebase origin main`.

**Prefer small, complete commits over long branches.** Two agents rebasing week-old work onto each
other is where the real conflicts come from.

**Stay out of a file another agent has claimed** unless the log says they are done. If you must
touch it, say so in the log entry.

**Do not silently reverse a decision.** The comments in this codebase state *why* something is the
way it is, at length and on purpose. If a comment explains a choice and you think it is wrong, say
so in the commit message and in the log — do not just change it. Several of those comments are
load-bearing (see §1 and §2).

**Founder decisions are recorded, not re-litigated:** `docs/SPEC-08-DECISIONS.md` and
`docs/SPEC-08-TRACKER.md`. Check them before proposing something that sounds new.

## 6 · Live customer rules

There is a real property being onboarded. Treat production as production.

- **Stripe is TEST-mode only.** Never a live key.
- **Payments are mocked.** Do not wire a real gateway without an explicit decision.
- **Demo tenants (`Tenant.isDemo`) stay out of money and portfolio metrics** and must never be
  pointed at a real Channex property. Operations and health metrics *do* include them.
- **Back up before any migration.** `docs/RESTORE.md`.
- **Channex bills per property with an active channel.** Creating properties, rooms, rates and
  pushing ARI are all free; activating a channel is not. Rehearse with `--sandbox`.
- **Fiscalization: we do not fiscalize, deliberately and permanently.** Driving a hotel's fiscal
  device makes our software СУПТО under Наредба Н-18 and lands the obligations on the *hotel*. See
  `docs/specs/BG-FISCALIZATION-RESEARCH.md` before touching anything invoice-related.
