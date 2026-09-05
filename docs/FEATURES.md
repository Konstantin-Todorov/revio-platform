# What Revio actually does

> **The register of shipped features, in customer language, for the website and the sales call.**
>
> `POSITIONING.md` is the *story*. This is the *inventory* — and it exists because a marketing site
> built from memory is a marketing site that promises something we do not have.

## The one rule

**Nothing goes in this file until it is live, and every entry names where it lives** so the claim can
be re-checked rather than believed. A feature that is built but not reachable by a customer is not a
feature; it goes in `BUILD-PLAN.md` until it is.

That rule is not theoretical. On 2026-09-05 a single day's audit found **six** documents claiming
work remained that had shipped, or claiming something shipped that had never once run. If this file
is allowed to drift the same way, the website inherits the drift — and a promise on a website is
harder to retract than a checkbox.

---

## 1. The platform claim — one core, no migration

**Buy one product, add the others later, with no data migration and no re-onboarding.** The products
are separate purchases, not separate systems: same rooms, same rates, same guests, same login. Adding
one is a flag, not a project.

This is the whole architecture and it is what the competition structurally cannot match — an all-in-one
suite makes you take everything, and a point solution makes you integrate. *`@revio/core`; entitlements
`hasChannelManager` / `hasReservation` / `hasPms`.*

- **A first-run setup that knows what you already told us.** Add a second product and it opens on one
  screen naming what carried over — property, room types, prices, branding, staff logins, each with
  its source — and asks only what is genuinely new. Six screens become three.
  *`core/onboarding/welcome.ts`, 66 tests.*

## 2. Trust — the things a hotel is right to ask about

- **Your data is isolated by the database, not by our code being careful.** Postgres Row-Level
  Security; every service connects as a restricted role with no ability to bypass it. A bug in our
  application cannot show another hotel's rows. Enforced in production since 2026-08-05, and proved
  by a test suite that connects as a hotel and counts what it can see. *`packages/db`, `rls-verify`.*
- **We never store card numbers.** A token and the last four digits, nothing else, ever. *`@revio/payments`.*
- **Money is never a floating-point number.** Integer minor units end to end, with an automated check
  that fails the build if an unreadable number can reach the database. *`money-lint`.*
- **Two-factor authentication on every product**, not just the admin console, with the code step rate-
  limited separately so a correct password does not buy unlimited guesses.
- **Passwords are checked against known breaches** — via an API that never receives the password, only
  the first five characters of its hash. Composition rules stop nothing when the result is `Password1!`.
- **Sign out everywhere.** Changing a password ends every existing session, in every product, because
  the whole point of resetting a stolen password is that the thief stops being logged in.

## 3. RevioLink — distribution that tells the truth

- **You do not need a Channex account.** We are the certified partner; the connection is ours.
- **A channel is never shown as healthy when it is not.** Health is derived from the last *successful*
  sync, never from the last *attempt* — a channel failing every five minutes has a very recent
  attempt. Three screens once reported green over a dead channel; an automated check now makes that
  specific mistake fail the build. *`core/metrics/sync-health.ts`, `health-lint`.*
- **"Nothing failed" and "nothing was tried" are shown as different things**, because a quiet
  24 hours and a broken connector look identical if you only count failures.
- **Cost of distribution.** What each channel actually cost you — commission *paid* as a fact, kept
  visually and structurally apart from commission *avoided*, which is a counterfactual and is shown as
  unavailable rather than guessed when there is no OTA revenue to derive a rate from.
  *`core/metrics/channel-economics.ts`.*

## 4. RevioCRS — the record, and numbers that agree

- **One availability truth** across distribution, reservations and the front desk. The reason the
  channel manager exists is to stop two guests booking the same room; keeping a second copy of
  inventory would recreate that problem inside our own platform.
- **The dashboard and the reports read the same functions**, so the two can never disagree. There is
  one formula sheet, not one per screen. *`core/metrics/formulas.ts`.*
- **A waitlist that turns a sold-out date into a booking.** A cancellation an hour later currently
  tells nobody; this notices and offers the room to the next guest in line.
  - The offer is **sequential and backed by a real hold**. The obvious design — email everyone who
    wanted those dates — creates a race where five guests click, one wins, and four are told the room
    has gone *after being told it was free*. That is worse than never writing to them.
  - **Every night or none.** A partial match is a disappointment with a link on it.
  - **A stop-sell is respected.** Ignoring it would sell rooms the hotel deliberately withdrew — the
    one way this feature could harm the person who switched it on.
  - The guest gets **four hours**, not the checkout page's thirty minutes: an offer arrives by email
    and the guest may be asleep. *`core/waitlist/`, 26 tests; `@revio/booking` sweep, 26 tests.*
- **Recovered revenue is reported honestly.** Two rates, never one: how often an offer converts
  (that measures us) and how much of the demand was served (that mostly measures how often rooms come
  free). One number alone flatters or damns depending which you picked. *`core/metrics/waitlist.ts`.*

## 5. RevioPMS — running the day

- Front desk, housekeeping with an inspection gate, folios and invoicing with a gapless series,
  minibar/POS, maintenance, and a night audit.
- **A day cannot be closed twice.** The business date only rolls if it is still the date we read, so
  a manual close and the automatic one cannot both advance it and skip a day.
- **Rooms are re-checked in the last hours before arrival**, when the house's picture is finally
  accurate — but never for a marginal gain, and never for a guest a person has already placed by hand.
- **A guest's stay ends when they leave**, recorded as its own fact rather than as a status, because a
  departed guest's stay is still sold and still earns.

## 6. RevioDirect — the hotel's own booking page

- **All-in pricing.** The first number a guest sees is the number they pay — one calculation behind
  the quote, the summary, the confirmation, the email and the folio.
- **A booking lands everywhere at once**, with no integration step: the reservation, the guest
  profile and the front-desk arrival are one record, not three synchronised copies. Demonstrated end
  to end on production.
- **Contrast is measured, not eyeballed.** The hotel picks a brand colour and uploads its own hero
  photograph; we measure the actual contrast of white text over that actual image and refuse to go
  below the accessibility floor — and we show the hotel the number.
- **Sold-out dates return real alternatives**, re-quoted from the same availability engine, rather
  than an apology.
- **A returning guest is recognised after they submit, never by a live email lookup** — on a public
  page that endpoint would let anyone test whether an address has stayed at the hotel.

## 7. Guest feedback — asked properly

- **Everyone is asked the same thing, and everyone is shown the same public review links.** The
  rating decides who is told internally and how fast; it never decides who is invited to review
  publicly.
- Competing tools route happy guests to Google and unhappy ones to a private form. That is review
  gating: it breaches Google's policies, regulators treat it as deceptive, and **the risk lands on the
  hotel, not on the vendor**. A score that has been engineered also teaches the hotel nothing.
- We took the goal and rejected the mechanism, and the rule is enforced by a test rather than by
  good intentions. *`core/feedback/`, 35 tests.*

> This is a competitive difference worth saying out loud on the website, and one most of the category
> cannot say.

## 8. How it is built — proof points for the "why trust you" section

- **A failing build never reaches a hotel.** Work lands on one branch; a separate branch is
  fast-forwarded *only* when the tests passed on that exact commit, and that is the branch the
  servers watch. A red build simply stops, and the last good version keeps serving.
- **Eleven automated checks run on every change**, including ones written after real incidents: money
  that cannot be parsed, health claimed without being measured, a control with no visible focus
  state, an action that fails silently, a schema that no longer matches the database.
- **Every scheduled job is monitored for having actually run**, and a job that has never run at all
  is reported — which is how we found one that had shipped, been tested, and never once executed.
- **Backups are taken and restores are rehearsed**, not assumed. *`docs/RESTORE.md`.*
- **Defects are recorded as classes, not incidents.** When something breaks we fix every instance,
  add an automated guard, and prove the guard fails before trusting it. *`docs/GAP-REGISTER.md`.*

---

## How to add to this file

1. Ship it, and check a customer can actually reach it.
2. Write it as **what it does for the hotel**, not what it is called internally.
3. Name where it lives, so the next person can re-verify instead of trusting this file.
4. If a claim needs a qualifier to be true, write the qualifier. A hedge on a website is survivable;
   a promise that is not quite true is not.
