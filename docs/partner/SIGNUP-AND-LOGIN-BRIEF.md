# Website brief — "Log in" and "Start a free trial"

**For: the `revio-websites` repo (marketing site) and `docs.reviosoft.app`.**
**From: the platform side, where the destinations now exist.**
Written 2026-09-12. Founder decisions recorded here so the site and the product cannot drift apart.

---

## The two founder decisions

1. **One trial switches on all three products — and they keep only what they used.** Not one. Not
   "one now, add others later". The second half is not a softener, it is how the structure actually
   works: a signup creates **three separate `ProductTrial` rows**, they end independently, and the
   invoice prices only the entitlements that remain. So a hotel can be shown everything and keep
   one. ⚠️ **The site must never say the first half without the second** — "all three products"
   alone reads as "we are about to charge you for three products", which is the opposite of the
   offer.
2. **Login: a product chooser on the site now; a single central login next.**

Both are settled. The reasoning is below because copy written against the reasoning survives; copy
written against the mechanism has to be rewritten every time the mechanism changes.

---

## What exists on the platform side, today

| Thing | Address | State |
| --- | --- | --- |
| **Public signup** | `https://cm.reviosoft.app/signup` | ✅ live |
| Confirmation screen | `https://cm.reviosoft.app/signup/sent` | ✅ live |
| RevioLink login | `https://cm.reviosoft.app/login` | ✅ live |
| RevioCRS login | `https://crs.reviosoft.app/login` | ✅ live |
| RevioPMS login | `https://pms.reviosoft.app/login` | ✅ live |
| Central login (one door, routes by entitlement) | — | ⏳ next |

⚠️ **Signup is hosted on the RevioLink origin but is NOT a RevioLink signup.** The account it
creates owns all three products. The page wears the Revio name, not RevioLink's. When the central
login lands on its own origin, signup moves with it and leaves a redirect — so **link to it, do not
rebuild it**.

---

## The header

Two buttons. `Log in` quiet, `Start free trial` the only filled button on the page.

### `Start free trial` → `https://cm.reviosoft.app/signup`

One link. No product choice on the website — the signup page asks the one question itself, in the
hotel's own words, and the answer only decides which product opens first.

### `Log in` → a chooser

Three cards: **RevioLink**, **RevioCRS**, **RevioPMS**, each with its one-line job, each linking to
that product's `/login`.

**Remember the last choice in `localStorage`** and show it as a primary *"Continue to RevioLink"*
with the other two beneath. A returning user then answers the question once, ever.

> ⚠️ **Do NOT build an email box that looks up which product someone has.** "Type your email and
> we'll send you to the right place" is an account-enumeration oracle: it tells anyone who can type
> which hoteliers are Revio customers. The booking engine already refused this exact shape. The
> chooser is the design *because* of this, not in spite of it.

---

## Copy that must stay true

These are facts the product enforces. If the site says otherwise, the site is wrong.

- **"30 days. All three products. No card."** — all three entitlements switch on together, and no
  payment method is collected anywhere in the flow.
- **"Keep only the ones you use — you pay for those alone."** — enforced, not aspirational: three
  independent `ProductTrial` rows, closed one at a time by an operator, and `generateInvoices`
  prices only what is still switched on. **Say this wherever "all three" appears.**
- **"You pay from the day you decide — never for a day of your trial."** — the joining month is
  prorated from the day the trial ended (`packages/core/src/billing/proration.ts`). True since
  2026-09-13 and not before.
- **"One account for every Revio product."** — one identity across all three; entitlements decide
  what it opens. ⚠️ **Not "one login".** This line said "one login" until 2026-09-13, which
  contradicts the central-login section below: there are three sign-in pages today, one per origin,
  and a single front door is deliberately deferred. Codex caught the contradiction between the two
  halves of this document; the site is already corrected.
- **"Nothing to migrate when you add the second one."** — same database, same rooms and rates. This
  is the platform's central claim and the reason the price list discounts the 2nd and 3rd product
  (0% / 10% / 20%).
- **"We email you a link to confirm your address and choose a password."** — the account is inert
  until that link is opened. Nobody at Revio ever knows a customer's password.
- **Do NOT write "free forever", "no commitment required" or any trial length other than 30 days.**
- ⚠️ **Do NOT write "commission-free" about RevioDirect.** We charge **2%** on bookings our engine
  produces (`DIRECT_BOOKING_FEE_PCT`). The true sentence is the stronger one: 2% against the 15–18%
  an OTA takes. The live signup page said "commission-free" twice until Codex caught it on 13 Sept.

---

## What the visitor actually experiences

1. Clicks **Start free trial** on the website.
2. Fills in: hotel name · their name · work email · *what do you need most right now?* (three
   options, in hotel words — "Stop the OTAs double-booking my rooms", "Take bookings direct and keep
   them in order", "Run the front desk and housekeeping").
3. Sees **Check your email**.
4. Opens the link → chooses a password → signs in → lands in the product they named, with the other
   two in the switcher.

⚠️ Step 3 must not promise "we've created your account", because sometimes we have not.

⚠️ **It does NOT say the same thing for every address, and this line used to claim it did.** The
three endings are set out below: a new mailbox reaches `/signup/sent`, while an address that already
finished an account is redirected to `/signup/existing?reason=…`. That is a deliberate founder
decision — a hotel that already has an account is told so rather than left waiting for an email that
will not come — and it was decided after this section was written. The copy rule that survives is
the narrow one: **never say the account was created**, because on one of the three paths it was not.

---

## For `docs.reviosoft.app`

⚠️ **Three articles, not two** — this said "two" and was written before the trial-ending article
existed. Codex owns all four slots; three are written and awaiting UI review, and the fourth is
deliberately out of the public navigation while central login is deferred. See
`docs/partner/TRIAL-COPY-RESPONSE-2026-09-13.md`.

The slots, and what each must contain:

1. **"Starting your free trial"** — the four steps above; that the trial covers all three products
   and why; **that they keep only the ones they used and pay for those alone**; that no card is
   needed; that the link expires in 7 days and works once (the authority is `TOKEN_POLICY.invite` —
   never re-type it); what to do if the email does not arrive (spam, then the sign-in page's
   *Forgot password*).
2. **"Signing in to the right product"** — that one email and one password open every product the
   hotel has; which product does what, in one line each; that a hotel sees only what it owns.

3. **"What happens when the trial ends"** — the article support will be asked about most. Contents
   are in the section below; all of it is enforced in code.

4. **"One login, three products"** — ⛔ **deferred, and deliberately not in the public navigation.**
   It replaces article 2 and must not be written before the behaviour exists: Claude provides the
   shipped URL and the verified hand-off before a single instruction is written. See
   `docs/specs/CENTRAL-LOGIN-DESIGN.md`.

**Article 3 in full** — the trial ends per product; nothing is deleted; they keep the ones they used; **the month they
decide in is charged only from that day, never for a trial day**; every month after it is a whole
month; there is no self-serve checkout yet, so they tell us and we switch it on. All of that is
enforced in code — `trials/`, `billing/proration.ts` and `generateInvoices` — so the article can
state it flatly rather than hedging.

---

## The three endings, and the copy for each

A signup now ends one of three ways. The site should not promise any single one.

| What happened | Screen | What it says |
| --- | --- | --- |
| New mailbox | `/signup/sent` | *Check your email* — open the link, choose a password, trial starts |
| Started before, never confirmed | `/signup/sent?again=1` | *We've sent that link again* — same hotel, fresh link, the old one is dead |
| Already a finished account | `/signup/existing` | *You already have a Revio account* — sign in, reset password, or pick a product |

⚠️ **No second trial is ever started from this form.** A hotel that trialled RevioCRS and RevioPMS,
did not buy, and comes back four months later is sent to sign in. That is enforced in the database
and covered by tests that run against a real one.

⚠️ **Aliases are the same mailbox.** `maria+trial2@gmail.com` and `m.a.r.i.a@gmail.com` are
recognised as `maria@gmail.com`. Sub-addressing is the commonest way a trial is taken twice and it
needs no skill at all.

Temporary-mailbox providers (Mailinator, 10MinuteMail and similar) are refused with a message that
explains why: that address is where their bookings and invoices will go.

---

## Day 31 — exactly what happens, so the site can say it

Codex asked for this before the website promises anything about the end of a trial. These are the
states as built, not as intended.

**Nothing is deleted, ever.** The trial sweep flips the product's entitlement off and writes
`outcome: "expired"`. Every room, rate, booking and login stays exactly where it was. A hotel that
comes back a year later finds its data intact — that is the founder's rule and it is enforced by
there being no deletion path in the sweep at all.

**They can still sign in.** The account stays `active`; only the entitlement goes. Opening the
product they lost shows a screen that says the trial ended, names the date, states plainly that
nothing was deleted, and offers **"I want to keep it"** — which records the ask against the trial
(`keepRequestedAt`) for the operator to act on. It does NOT switch anything back on: converting a
trial is a deliberate decision a person at Revio makes.

> ⚠️ **Corrected 2026-09-13, after Codex asked for this section to be confirmed as built.** It was
> not. `signIn` refused an account whose entitlement was off — *"RevioLink isn't enabled for this
> hotel"* — so the screen above was reachable only by a hotel that still had a live cookie from
> before the sweep ran. Everyone who came back after the trial-end email, which is exactly who it is
> for, was stopped at the door by the sentence `ProductLocked` was built to replace. Login no longer
> refuses; the entitlement is now checked in `authz.ts` before every write, where a layout cannot be
> bypassed by replaying a server action. RevioPMS had always checked it there; RevioLink and
> RevioCRS never had.

**It is never a dead end.** A trial ends per product, so the screen always lists the products that
still open. A hotel that loses RevioLink but kept RevioCRS goes straight there.

**One trial per product, ever.** A second trial of the same product is refused by
`canSelfStartTrial`, and the ended-trial screen does not offer one — offering it would be a promise
the writer refuses a click later.

⚠️ **Copy the site must NOT use:** "free forever", "cancel any time" (there is nothing to cancel —
no card is taken), any trial length other than **30 days**, or any promise about what happens to
data after the trial beyond "nothing is deleted".

⚠️ **Still unsettled, so the site must not promise it:** how a trial converts to a paid account.
There is no self-serve checkout — an operator grants it. Until that exists, the honest sentence is
"tell us and we'll switch it on", never "upgrade any time".

---

## Central login — the three states it must handle

Codex asked for these to be named before the website says anything about one login. They are the
states that exist today, each already reachable at a per-product login:

| State | What the platform does | What the person sees |
| --- | --- | --- |
| **Ended trial** (account active, entitlement off) | Signs in. `authz.ts` refuses writes to that product. | `ProductLocked`: the end date, *nothing has been deleted*, **I want to keep it**, and the products that still open. |
| **Suspended account** (`tenant.status !== "active"`) | Refuses the sign-in, after the password is verified. | *"This account is suspended — contact Revio."* No session is issued and `getSession` would refuse one anyway. |
| **Never had the product** (no trial, entitlement off) | Signs in. Same write refusal. | `ProductLocked` making a real offer — *try it free* — because for this hotel a first trial is genuinely available. |

Two consequences for a single front door: it must route on **entitlements**, not on which product
was asked for, and a suspended account is the one case where it must stop at the door, because
suspension is about the account itself rather than about one product.

The decision itself is now **one function** — `loginDestination` in `@revio/core`, four answers
(`open` / `locked` / `elsewhere` / `refused`), pinned across all 64 combinations of entitlement and
request. A central login calls it and re-decides nothing. ⚠️ **Codex: a fourth state exists that the
table above does not name** — a hotel that asks for a product it has NEVER had while owning another
is sent where it was going (`elsewhere`), not onto a sales screen. An offer in the way of somebody
trying to open the software they pay for is an advert, not help.

⚠️ **Central login is NOT built, and that is a decision rather than a gap.** The session hand-off
between origins has a real security trade-off and there is no user for it yet — no hotel owns a
second product. The options, the recommendation and what must be true of whatever is built are in
[`docs/specs/CENTRAL-LOGIN-DESIGN.md`](../specs/CENTRAL-LOGIN-DESIGN.md). **The site must not
promise "one login for every product" as a thing that exists today** — "one account" is true and
"one login" is not, yet.

⚠️ A **`pending_signup`** account (verified email not yet clicked) has no password set, so it fails
the password check and gets *"Invalid email or password"*. That is deliberate — a distinct message
would confirm to a stranger that the address has an account here.

---

## How the money works when a trial converts — DECIDED 2026-09-13

Codex asked how the trial lifecycle interacts with assisted-onboarding first-sync billing. Checked
end to end, then fixed. **The website may now say this, because it is what the code does.**

**Nothing is charged during a trial, and a trial day is never billed afterwards.**
`generateInvoices` drops every product with an open `ProductTrial`, and it only ever generates the
CURRENT month, so a past trial month cannot be billed retroactively either.

**The joining month is prorated; every month after it is a full calendar month.** The first
invoice covers only the days from the day the trial ended (or, for an assisted client with no
trial, the day they went live) to the end of that calendar month. The invoice line says so in
words: *"from 2026-09-20 — 11 of 30 days"*.

⚠️ **"Joining" means the hotel's first billable month, not each product's.** A hotel already paying
for one product that converts a trial of a second mid-month is charged a **full month** for that
month — the ordinary SaaS convention for an upgrade. Prorating there would discount the product
they have been paying full price for all year. So the site may say "you pay from the day you
decide" about a **first** trial, and must not extend it to adding a further product later.

⚠️ **It did not work this way until 2026-09-13.** Converting a trial set `endedAt = now` and kept
the entitlement, so from that instant the product was priced for the whole calendar month —
including the days earlier in that month that were free. A trial converted on the 29th billed all
30 days. `packages/core/src/billing/proration.ts` is what makes the promise true.

### Why this shape and not another

Two alternatives, both defensible, both worse. *Bill the whole month* keeps the money and hands
every converting customer a wrong-looking invoice at the worst possible moment — the first one.
*Start billing on the 1st of the next month* is honest and gives away up to a month per customer.

It is also what this market does. **SiteMinder** and **Little Hotelier** — direct competitors, both
no-card trials, both calendar-month invoicing — each issue a first invoice containing the prorated
remainder of the calendar month after the trial ends, then full months. Stripe, Chargebee and
Paddle reach the same outcome by moving the billing anchor to the trial end instead of prorating,
and all three refuse to bill trial days.

We keep calendar months — hotels do monthly accounting and one invoice date across the portfolio is
worth keeping — and prorate the joining month. That is the SiteMinder shape.

### Copy the site MAY now use

- *"You pay from the day you decide — never for a day of your trial."*
- *"Your first invoice covers the rest of that month only."*

### ⚠️ "Free until your first booking syncs" is NOT the trial — Codex is right to separate them

Codex flagged `src/config/offer.ts` presenting this as a general homepage promise. It is not one.
The two are different offers and the platform treats them as different things:

| | Who it is for | What starts the clock |
| --- | --- | --- |
| **30-day free trial** | Self-serve signup | The day the account is confirmed. Ends on day 31. |
| **Free until your first booking syncs** | **Assisted onboarding** — a hotel we set up | `markBillable(…, "first_booking_synced")`, and only for a client WITH channel management |

Read together on one page they contradict each other: a hotel on a 30-day trial whose first booking
syncs on day 3 would reasonably conclude the free period just ended. It did not — the trial runs its
30 days regardless, `billableEntitlements` drops a product while its trial is open, and
`firstBillableDay` never bills a trial day. **The homepage must say which offer it means.**

### Copy the site still must NOT use

- *"Cancel any time"* — there is nothing to cancel; no card is taken.
- *"Upgrade any time"* — there is no self-serve checkout. An operator switches it on.
- Any trial length other than **30 days**.

### Two things that are still true and small

The RevioDirect 2% usage fee is **not** prorated — it is a percentage of bookings our engine
actually produced. For a joining month the date range is narrowed instead, so bookings taken during
the free trial are not counted at all.

`markBillable` still stamps `billingStartsAt` even mid-trial, because it does not ask about trials.
No invoice is affected — `firstBillableDay` takes the later of that date and the trial's end — but
the operator console's "billable since" can read earlier than the paid relationship.

---

## Known gap, stated plainly

Repeated signups from **genuinely different mailboxes** for the same hotel would each get a fresh
30-day trial. Aliases of one mailbox are closed; two real addresses are not, and cannot be without
either a card at signup or manual review. There is a platform-wide ceiling of **12 signups per
hour**, which stops a script rather than a determined person. Closing it properly needs either a
card at signup or manual review of new tenants — a commercial decision, not a technical one.
Unverified signups sit as `pending_signup` tenants with no entitlements and no trial clock, so they
are visible and sweepable rather than silently costly.
