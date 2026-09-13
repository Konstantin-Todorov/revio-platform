# Central login — the decision that needs a person

**Status: NOT BUILT. One founder decision away.** Written 2026-09-13.

The routing logic is built and tested (`packages/core/src/onboarding/login-destination.ts`, 14
tests). What is not built — deliberately — is how a session issued at one origin becomes a session
at another, because every option carries a different security trade-off and this is the one part of
the platform where being wrong means somebody else reading a hotel's data.

---

## Where we are

Three products on three origins, each with its own session cookie, each scoped to its own host:

| Product | Origin | Cookie |
| --- | --- | --- |
| RevioLink | `cm.reviosoft.app` | `revio_session` |
| RevioCRS | `crs.reviosoft.app` | `revio_crs_session` |
| RevioPMS | `pms.reviosoft.app` | `revio_pms_session` |
| Operator | `operator.reviosoft.app` | `revio_op_session` |

One identity, three logins. A hotel that owns two products signs in twice.

`/login` on each origin works today, and the website sends people to a **chooser** — the interim the
founder agreed to. Codex has been told not to invest further in the chooser.

**One thing is already fixed and is a prerequisite:** the three apps used to disagree about what a
correct password means — RevioLink and RevioCRS refused the sign-in when the product's entitlement
was off, RevioPMS let them in and showed the locked screen. A single front door cannot be built on
three opinions. `loginDestination` is now the single answer, and the two refusing apps were
corrected on 13 September.

---

## The choice

### Option A — a cookie on the parent domain

Set the session cookie with `Domain=.reviosoft.app` instead of the current host-only scope. Every
subdomain then receives it, and one sign-in opens all three.

**For:** almost no new code. No token exchange, no new endpoint, no new failure mode. The session
model, revocation (`sessionsValidFrom`), 2FA and "sign out everywhere" all keep working unchanged.

**⚠️ Against, and it is not small:** `booking.reviosoft.app` is the **public, unauthenticated guest
surface**. A parent-domain cookie is sent to it on every guest request — including requests from
people who are not customers at all. The cookie is `httpOnly`, so page scripts cannot read it, but
the booking server receives a staff session token on ordinary guest traffic, and any future XSS or
log-capture on that origin becomes staff-session theft. The booking engine is also the app most
exposed to arbitrary input, because anyone on the internet can reach it.

That risk can be contained — serve the booking engine from a different registrable domain, or set
the cookie on a narrower parent that excludes it — but containing it is the work, and it is a DNS
and deployment change rather than a code one.

### Option B — a one-time hand-off token

A central login authenticates, then redirects to the target product with a short-lived, single-use
token in the URL. The product verifies it and sets **its own** cookie, exactly as it does today.

**For:** cookies stay host-scoped, so the booking engine never sees one. It is the standard shape
(it is how SSO redirects work), and the codebase already has the pattern — the 2FA pending token is
a short-lived single-use credential with its own rate-limit gate.

**Against:** a new credential type that grants a session. It must be single-use, expire in seconds,
be bound to the account AND the target product, survive a replay attempt, and never appear in a
referrer or a server log. Each of those is a known requirement with a known implementation, and each
is a way to get it wrong.

### Option C — leave it

The chooser works. A hotel with one product — which is every hotel today, since MRR is €0 — signs in
once and never notices. The cost is real but small, and it grows only as hotels buy second products.

---

## Recommendation

**Option B, and not yet.**

B is the right end state: it keeps the booking engine out of the blast radius without a DNS change,
and it is the shape everyone else uses. A is tempting precisely because it is nearly free, and the
thing it costs is the one we would not notice until it mattered.

"Not yet" because the argument for doing it now is weak. Nobody owns two products today. The
work that *is* on the critical path — letting hotels set themselves up — is done, and central login
does not block it. Building a new session-granting credential while there is no user of it, with
nobody available to test the failure modes, is the wrong order.

**Build it when the first hotel owns a second product.** That is the moment the pain is real, the
moment there is somebody to test against, and the moment the trade-off is worth paying.

---

## What is already done, so the build is short when it starts

- **`loginDestination`** — the four answers (`open` / `locked` / `elsewhere` / `refused`), tested
  exhaustively across all 64 combinations of entitlements and request. A central login calls this
  and does not re-decide anything.
- **The three states Codex asked to have named** are in
  `docs/partner/SIGNUP-AND-LOGIN-BRIEF.md`: ended trial, suspended account, never had the product —
  plus `pending_signup`, which fails the password check on purpose.
- **The entitlement is enforced on writes** (`authz.ts` in all three apps), not only in a layout, so
  issuing a session for a hotel that has lost a product is safe.
- **Revocation is session-table-free** (`checkSessionValidity` against `sessionsValidFrom`), so
  whatever mechanism is chosen inherits "sign out everywhere" without extra work.

## What must be true of whatever is built

1. **A suspended account never gets a session** — it is the one refusal that belongs at the door.
2. **An entitlement a hotel does not hold never becomes an `open`** — the invariant the 64-combination
   test pins.
3. **The operator perimeter is never reachable from a hotel session.** Different cookie, different
   JWT `kind`, and the check stays in every app.
4. **No credential in a URL outlives its use** — single-use, seconds not minutes, and never logged.
