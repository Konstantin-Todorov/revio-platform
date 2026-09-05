# Guest feedback and review requests — without gating

> Programme: `docs/IDEAS-1CLUB-2026-09.md` item 2. Products: **RevioCRS** (config + inbox) +
> the existing email engine. Entitlement: `hasReservation`.

## Why this is worth building

A hotel's Google and Booking.com scores are, for most independents, the single biggest lever on
direct demand — more than the website, more than the rate. We already email every guest after
checkout (`post_stay`), and that email currently asks for nothing measurable.

We also already hold the thing that makes this better than a generic review tool: **we know the
stay**. Which room, how many nights, which channel, whether the folio balanced, whether they were
moved rooms, whether a maintenance ticket was open on their unit. A feedback request that knows all
that can ask a better question and route the answer to the right person.

## ⚠️ The thing we are deliberately NOT copying

1club "prompts happy members to post public reviews on Google, while constructive feedback is routed
directly to your management team." That is **review gating**: filtering by sentiment, then soliciting
publicly only from the satisfied.

**Google's review policies prohibit soliciting reviews selectively**, and consumer-protection
regulators treat sentiment-filtered solicitation as a deceptive practice. Beyond the compliance
question it is bad for the customer we are selling to: a hotel whose public score is engineered is a
hotel that learns nothing, and the risk lands on **them**, not on us.

So we take the goal and reject the mechanism.

> **Everyone is asked the same thing.** The rating decides who is *told internally* and how fast —
> it never decides who is invited to review publicly.

That is a defensible sentence to put in front of a hotelier, and it is a competitive difference we
can state out loud.

## The flow

**1 — Ask (extends `post_stay`).** The existing after-departure email gains one question with five
one-click answers. Each is a signed link, so answering takes no login and no typing:

> *How was your stay at {{propertyName}}?*  ★ ★ ★ ★ ★

**2 — Land on a thank-you page** (RevioDirect, the hotel's brand) that does two things for
*everybody*, in this order:

- an optional free-text box — *"Anything you'd like us to know?"*
- **the public review links** — Google, TripAdvisor, the hotel's own — shown to every rating

**3 — Route internally by rating.** This is the only place the rating changes behaviour:

| Rating | Internal behaviour |
| --- | --- |
| 1–2 | **Alert now.** Email the property's reservation inbox, raise an item on the CRS dashboard's Action Center |
| 3 | Logged, surfaced in the weekly digest |
| 4–5 | Logged, counted |

⚠️ The public links are identical in all three rows. Only the internal urgency differs.

## The model

```
GuestFeedback
  id, tenantId, propertyId
  reservationId          -- the stay it is about; feedback with no stay is not feedback
  guestId?
  rating        Int      -- 1..5
  comment       String?
  askedAt, respondedAt?
  token         String    @unique   -- signed, single-use, expires
  publicPromptShown Boolean         -- did we show the review links (always true today; audit trail)
  source        String    -- post_stay | manual
```

⚠️ **One feedback row per reservation.** A guest who clicks two stars and then five has changed their
mind, not left two reviews — the row is updated and the change is recorded in the audit log. Two rows
would double-count the hotel's average, which is the number they will quote at us.

## Configuration — ☑ shipped 2026-09-05, RevioCRS → Settings

### ⚠️ The screen explains itself, and that is a requirement rather than a nicety

A hotelier arriving at this card is looking for the setting every competing tool has — *"only ask
guests who rated 4+"* — and its **absence would read as an oversight or a missing feature**. Founder's
call, and the right one: say it out loud, so it reads as a decision they can repeat to their own
boss. They are also the party who carries the consequence, and most have never been told that.

The card leads with the rule, then the routing table, then the reasoning:

> **Everyone is asked the same thing, and everyone sees the same review links.**
> The rating decides who we tell inside your hotel, and how fast. It never decides what the guest is
> shown.
>
> | 1–2 stars | Emailed to you straight away and raised in the Action Center, so someone can call them the same morning. |
> | 3 stars | Logged, and in your weekly summary. |
> | 4–5 stars | Logged and counted towards your average. |
>
> **Why there is no "only ask happy guests" option.** Choosing who to invite based on how they rated
> is called review gating. Google's policies prohibit soliciting reviews selectively and regulators
> treat it as deceptive — and the consequence lands on **your listing**, not on us. It also works less
> well than it looks: most properties need more reviews rather than fewer, and asking everyone with
> one tap produces more of them. Reaching an unhappy guest the same morning is the better version of
> the same idea — a complaint you have already fixed is often never written down.
>
> **Booking.com is not on this list.** They send their own review invitation and do not allow anyone
> else to collect reviews for their platform.

### The fields

- **Review destinations**: Google place URL, TripAdvisor URL, own URL. Blank = not shown.
- **Ask after**: N days post-departure (default 1).
- **Ask at most every**: N months per guest — a repeat guest staying monthly must not be asked
  monthly.
- **Low-rating alert recipients**: defaults to `reservationEmailPrimary`.

⚠️ **Booking.com reviews cannot be solicited by us** — the OTA sends its own invitation and forbids
third-party collection for its platform. The destination list is Google / TripAdvisor / own. Saying
so in the UI prevents a support question and a false expectation.

## Suppression rules — when we do not ask at all

Asking the wrong guest is worse than not asking:

- the stay was **cancelled** or a **no-show**
- the guest has `recognitionOptOut` (the existing K6 flag — it means leave me alone, and this is the
  same spirit)
- they were asked within the configured window
- the folio has an **unpaid balance** — chase the money or the review, not both in the same week
- no email on the reservation

## What it feeds

- **CRS dashboard**: average rating, response rate, and the count of unresolved 1–2 star responses.
  The last one belongs in the **Action Center**, which already exists for "things that need a person".
- **Operator console**: rating trend per client. A hotel whose score is sliding is a hotel that will
  blame the software at renewal — `clientAttention` should know before the call.
- **Metrics module** so the CRS and Operator read one function, per the existing rule.

## Build order

1. ☑ **`packages/core/src/feedback/` — shipped 2026-09-05, 35 tests.** `routeFeedback`,
   `canAskForFeedback`, `isPermanentRefusal`, `askDueAt`, `addMonths`, `averageRating`,
   `summariseFeedback`.

   **The anti-gating rule is executable, not just written down.** `routeFeedback` returns
   `showPublicLinks` as a field that is always `true`, and a test asserts it across all five ratings
   — so introducing gating means deleting a passing test that says why it exists, rather than quietly
   adding a condition. Proven: making the links conditional on `rating >= 4` turns that test red.

   Three decisions the tests pin beyond the spec:
   - **Refusals are ordered by permanence, not by convenience.** A guest who opted out *and* owes
     money *and* has not departed is reported as `opted-out` — the reason still true next week, and
     the only one a person can act on. `isPermanentRefusal` then lets a sweep stop reconsidering a
     stay it will never ask about, instead of re-evaluating it nightly forever.
   - **A credit balance is not a reason to go quiet.** The unpaid-balance rule is about not chasing
     money and a review in the same week; money owed *to* the guest is the hotel's problem, not a
     reason to skip them.
   - **`addMonths` clamps.** 31 January plus one month is 28 February, not 3 March. The naive
     `setMonth` rolls over, which would ask a regular guest *earlier* than the hotel's configured
     minimum — quietly breaking the one setting that exists to stop us pestering them.

   A rating outside 1–5 throws rather than clamping: clamping would turn an upstream bug into a
   silent 1-star alert or a silent 5-star average.
2. ☑ **Migration — shipped 2026-09-05.** `GuestFeedback` + `tenant_isolation` RLS + the unique on
   `reservationId`. `prisma migrate diff` reports no difference between the hand-written SQL and the
   schema, and `rls-verify` enumerates models carrying a `tenantId` rather than a hard-coded list, so
   the new table is covered without a second file to keep in sync.

   Three shape decisions worth keeping:
   - **The row is created when we ASK, not when they answer**, with `rating` nullable. That makes
     "asked and stayed silent" a fact we can count rather than an absence inferred from a missing row
     — which is what makes a response *rate* possible at all.
   - **`resolvedAt`** was not in the spec's model but the spec asks for "unresolved 1–2 star
     responses" in the Action Center. Without it that count cannot exist.
   - **`guestId` is `SET NULL`, `reservationId` cascades.** A guest profile merged away must not
     delete the rating; a stay that no longer exists cannot have feedback about it. Erasure
     anonymises in place and never deletes, so the null path is the merge case, not the GDPR one.
3. ☑ **The five one-click links in `post_stay` (EN + BG) — shipped 2026-09-05.**

   Built as a **`rating` block on `renderEmail`**, beside `details` and `cta`, rather than as markup
   inside the template body. Two reasons: presentation has to survive every theme, every font choice
   and Outlook (which renders through Word, so the row is a table — no flexbox, no grid); and the
   question stays **out of the hotel's editable body**. A hotel rewriting it as "Did we exceed your
   expectations?" would quietly change what the number means while the dashboard kept calling it the
   same average. `feedbackQuestion` / `feedbackHint` hold the wording, EN + BG.

   - **Every star is its own link with a 44px+ touch target.** A guest tapping between two stars and
     sending the wrong rating is a corrupted number nobody can detect afterwards.
   - **Each star carries its numeral.** Five identical glyphs give no way to aim, and a client that
     cannot render ★ shows five boxes.
   - **The plain-text part carries all five links**, as `★★★☆☆  3/5 — <url>`. Filled and empty stars
     need no translation and cannot disagree with the HTML about the scale; the `n/5` is there for
     screen readers and for clients that mangle the glyph. A text part that omitted the ask would
     make the email unanswerable for anyone reading text-only.
   - **The rating is in the URL path, not a query string** — some clients and link scanners rewrite
     or strip query parameters, and a five-star answer arriving unrated is worse than no answer: it
     counts as a response with no rating.
   - **A scale that is not five points throws at render.** Silently drawing four stars would change
     what the average means.

   The token is passed in by the caller, never minted here: it is single-use and tied to one
   `GuestFeedback` row, and a token invented in two places cannot be revoked in one.
4. RevioDirect thank-you route — brand-aware, mobile-first, works with no login.
5. ◐ CRS: **settings ☑ shipped 2026-09-05**; feedback list and Action Center wiring remain.
   Seven columns on `Property` (`reviewGoogleUrl` · `reviewTripadvisorUrl` · `reviewOwnUrl` ·
   `feedbackEnabled` · `feedbackAskAfterDays` · `feedbackAskEveryMonths` · `feedbackAlertEmail`).

   **The pasted URLs are a security boundary, not a formatting preference.** They are rendered as
   links on a public, unauthenticated page, so `normaliseReviewUrl` accepts only `http`/`https`,
   adds `https://` to the scheme-less paste a hotelier will actually make, and returns `null` for
   everything else — `javascript:` in an `href` is script execution against every guest who clicks.
   A refusal is reported to the hotel rather than silently saved as "no button". Tested, including
   that a refused scheme is never *rescued* by prefixing `https://` onto it.
6. Metrics + the operator trend.

## Open question for the founder

Do we ever want a **gated** mode, off by default, for hotels that ask for it? My recommendation is
**no** — not as a toggle, not off by default. The moment it exists we are shipping a feature whose
correct use is "never", and the first hotel that turns it on and gets caught will say the software
offered it.
