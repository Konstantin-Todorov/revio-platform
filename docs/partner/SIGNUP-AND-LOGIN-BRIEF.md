# Website brief — "Log in" and "Start a free trial"

**For: the `revio-websites` repo (marketing site) and `docs.reviosoft.app`.**
**From: the platform side, where the destinations now exist.**
Written 2026-09-12. Founder decisions recorded here so the site and the product cannot drift apart.

---

## The two founder decisions

1. **One trial switches on all three products.** Not one. Not "one now, add others later".
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
- **"One login for every Revio product."** — one identity across all three; entitlements decide what
  it opens.
- **"Nothing to migrate when you add the second one."** — same database, same rooms and rates. This
  is the platform's central claim and the reason the price list discounts the 2nd and 3rd product
  (0% / 10% / 20%).
- **"We email you a link to confirm your address and choose a password."** — the account is inert
  until that link is opened. Nobody at Revio ever knows a customer's password.
- **Do NOT write "free forever", "no commitment required" or any trial length other than 30 days.**

---

## What the visitor actually experiences

1. Clicks **Start free trial** on the website.
2. Fills in: hotel name · their name · work email · *what do you need most right now?* (three
   options, in hotel words — "Stop the OTAs double-booking my rooms", "Take bookings direct and keep
   them in order", "Run the front desk and housekeeping").
3. Sees **Check your email**.
4. Opens the link → chooses a password → signs in → lands in the product they named, with the other
   two in the switcher.

⚠️ Step 3 says the same thing whether the address was new or already had an account — deliberately.
Marketing copy must not promise "we've created your account", because sometimes we have not.

---

## For `docs.reviosoft.app`

Two articles are missing and are now answerable:

1. **"Starting your free trial"** — the four steps above; that the trial covers all three products
   and why; that no card is needed; that the link expires in 48 hours and works once; what to do if
   the email does not arrive (spam, then the sign-in page's *Forgot password*).
2. **"Signing in to the right product"** — that one email and one password open every product the
   hotel has; which product does what, in one line each; that a hotel sees only what it owns.

A third, once central login ships: **"One login, three products"** — replaces article 2.

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

## Known gap, stated plainly

Repeated signups from **genuinely different mailboxes** for the same hotel would each get a fresh
30-day trial. Aliases of one mailbox are closed; two real addresses are not, and cannot be without
either a card at signup or manual review. There is a platform-wide ceiling of **12 signups per
hour**, which stops a script rather than a determined person. Closing it properly needs either a
card at signup or manual review of new tenants — a commercial decision, not a technical one.
Unverified signups sit as `pending_signup` tenants with no entitlements and no trial clock, so they
are visible and sweepable rather than silently costly.
