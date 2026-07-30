# Package: Email (`@revio/email`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. Templates and rendering are pure
> and live in `@revio/core/email`; this package is the **side-effecting half**.

Every guest-facing email the platform sends. RevioLink sends reservation delivery and arrivals;
RevioDirect sends the booking confirmation — same engine, so a guest who books direct gets *the
hotel's* mail, not the platform's.

- `engine.ts` — resolve a property's saved wording + branding for a key and locale, render, send.
- `transport.ts` — Resend when `RESEND_API_KEY` is set, a log line when it is not.

## Parameterized by a Prisma surface, not by a client

`sendTemplatedEmail(db, args)` takes a small structural `EmailDb` interface. A staff-triggered email
passes a tenant-scoped proxy; an anonymous booking passes `forSystem()`, because a guest has no
session and there is no tenant context until a slug has resolved. Same pattern as
`@revio/connectivity` — the caller owns the perimeter decision, since the caller is the only code
that knows how it established one.

## Resolution rules a hotel depends on

- Nothing configured → the platform default still sends. A brand-new hotel's guests get correct mail
  on day one.
- The hotel's own wording wins wherever they have written some.
- A switched-off email returns `{ ok: true, skipped: true }` — so a caller can tell *"the hotel
  doesn't want this"* from *"sending broke"*. Those must never look the same.
- An unknown locale falls back to English. A Bulgarian guest at an English-only hotel gets English,
  never silence.

`engine.test.ts` pins all four.

## Two rules for callers

**Never block the thing that already happened.** A confirmation is sent inside a `try` that swallows:
the room is already booked, and a mail provider having a bad minute must not turn a completed
reservation into an error page.

**Pass the facts, don't re-query them.** `details` (the itemised stay) is supplied by the caller from
what the guest was just shown. A confirmation email that recomputes its own numbers can disagree with
the page the guest is looking at — and an email that arrives with no dates and no total is not a
confirmation at all. That shipped once and is why the parameter exists.

## Typeface

`emailFont: "serif"` must actually change the mail. Ten of sixteen font declarations once hardcoded
sans, so the selector appeared broken — it wasn't ignored, it was overridden. One deliberate
exception remains: **labels stay sans**, because Georgia at 10.5px with 0.14em tracking reads worse
than the alternative. Keep that exception documented if you touch it.
