# What we lack — RevioDirect against the field, and the platform through an owner's eyes

Written 2026-09-08, before the first paying hotel. Every "we have" below was checked in the code,
not taken from a document; every "we lack" was checked the same way, because the most expensive
mistake in a list like this is to build something twice.

Comparison drawn from what SiteMinder, Cloudbeds and Mews actually ship in 2026, not from their
marketing pages.

---

## First, what we already do that they mostly do not

Worth stating plainly, because it decides which of the gaps below are worth closing and which are
noise.

- **All-in pricing from the first screen.** One `computeStayCharges` produces the quote, the summary,
  the confirmation email and the folio, so the first number a guest sees is the number they pay. Most
  engines reveal taxes and fees at the last step, which is the single biggest cause of abandonment
  they then sell you a recovery tool for.
- **A waitlist that offers a freed room automatically.** Sold-out dates return *real* alternatives
  re-quoted from the same availability engine, and a cancellation triggers a sequential offer. Very
  few independent-market engines do this at all.
- **No integration step between the engine and the rest.** A direct booking is the same row the CRS
  and PMS read. Competitors' engines write to their own PMS too — but ours also means a hotel that
  buys another product later migrates nothing.
- **Contrast measured rather than assumed** on the hero image and every derived brand colour.

---

## RevioDirect — the real gaps

Ordered by what a Bulgarian independent hotel would actually notice.

### 1. One language, one currency ⚠️ the biggest

`<html lang="en">` is hard-coded and the price is always `property.baseCurrency`. For a hotel in
Varna or Sofia selling to German, British, Romanian and Bulgarian guests, that is not a polish item —
it is the reason a guest closes the tab. Competitors ship 20+ languages and a currency toggle as
table stakes.

Bulgaria's euro changeover makes the currency half sharper still: a hotel will want to show BGN and
EUR side by side during the transition, and the platform currently cannot show two.

**Size:** language is medium (the engine has maybe 120 guest-facing strings; the staff apps stay
English). Currency display is small if it is presentation-only — quote in base currency, *display*
converted with the rate and date stated — and large if we ever settle in another currency. Do the
first, never quietly do the second.

### 2. No promo or discount codes

Nothing in the codebase. This is the standard direct-booking lever — "book direct and save 10%" —
and it is how a hotel justifies the engine to itself. Also the mechanism behind almost every
abandonment-recovery email in the industry.

⚠️ Worth knowing the counter-argument before building it: a visible promo-code box makes guests
leave to hunt for a code. The better pattern is codes that exist but are only *given out* — in a
recovery email, a returning-guest link, a printed card at reception.

**Size:** medium. A `PromoCode` model, validation in the quote path, and it must flow through
`computeStayCharges` so the all-in promise survives.

### 3. No abandoned-booking recovery

Roughly 80% of people who start a booking do not finish. We already have what recovery needs and do
not use it: a `Hold` is created when the guest opens a room, and their email is captured at the
details step before payment. Today `abandonHold` simply releases the room.

An email an hour later — *"your room at Marina Bay is still available"* with a link that restores the
dates — is the highest-return item on this page, and it is close to free because the data is already
there.

⚠️ Do it carefully: only where the guest gave an email *and* the consent covers it, one message not a
sequence, and never for a guest who completed a booking elsewhere on the same property.

### 4. Nothing measurable — no analytics on the booking page at all

There is no GA4, no GTM, no Meta pixel, no conversion event. A hotel owner cannot see their own
funnel, cannot run an ad against it, and cannot tell whether the engine is working. Our new
first-party analytics measures *staff* screens, not guests.

**This is the one I would fix first**, because it is small and everything else on this list is
guesswork without it. A per-property GA4/GTM id in the booking-engine settings, and standard
`view_item` / `begin_checkout` / `purchase` events.

### 5. No Google Hotel Ads / metasearch feed

Google's free booking links now carry the majority of brand-intent hotel searches, and metasearch
costs roughly 7–12% of revenue against an OTA's 15–25%. This is the biggest single direct-booking
channel in the market and we are absent from it.

**Size:** large, and it is genuinely the most valuable thing on this list — but it needs a rate feed,
a Google Hotel Center account per hotel, and ongoing rate-accuracy above ~95% or Google demotes you.
Not before there are hotels to feed it.

### 6. Smaller, real

- **No guest-facing trust signals** — no review score, no "12 people looked at this room" (the
  honest version: cancellation terms and a clear contact are worth more than urgency theatre).
- **Extras exist but are thin.** `publicSellableExtras` works and is opt-in per POS item, which is
  right. What is missing is anything time- or occupancy-aware: airport transfer, late check-out, a
  bottle on arrival.
- **No multi-room booking in one reservation** — a family taking two rooms books twice.
- **Cancellation policy is a label with no terms.** A guest cannot read what happens if they cancel,
  which is the question every direct booker asks before choosing direct over Booking.com.

---

## The platform, read as a hotel owner

Not features from a competitor's list — the things an owner asks for in the first month.

### 1. "Can I actually take money?" — the honest answer is no ⚠️

We store a card token and never charge it. Every competitor takes deposits and prepayment. For a
hotel this is not a feature, it is the difference between a no-show costing them nothing and costing
them a night.

Deliberately deferred, and the deferral was right while there were no customers. It stops being
right the day one takes a booking for August.

### 2. "What should I charge tonight?"

We hold rates, restrictions, occupancy, pickup and STLY. We never *suggest* anything. Mews and
Cloudbeds both ship revenue hints now. Nothing here needs a model — "you are 40% booked for Saturday
and last year you were 80% at this point" is derivable today from data we already compute, and it is
the single most valuable sentence software can say to an owner.

### 3. "Talk to my guest"

Email is one-way and transactional. There is no pre-arrival message, no in-stay thread, no WhatsApp
— which in this market is how guests actually talk to hotels. The support ticket centre just built
is exactly the right shape for it; the guest-facing version is the same idea pointed the other way.

### 4. "Give my accountant what they need"

Invoicing is real and gapless. What is missing is the boring monthly export an accountant asks for,
and any link to accounting software. A hotel owner does not care about this until the 5th of the
month, and then cares about nothing else.

### 5. "My phone"

The apps are responsive and usable. There is no installable app and no push notification — so
"booking just arrived" and "room 305 is ready" do not reach a pocket. A PWA with web push would
cover most of it without an app store.

### 6. Deliberately still right to skip

- **Door locks, energy, POS hardware** — integrations that only pay off at scale.
- **Channel manager breadth** — seven OTA codes is enough; the long tail is not where these hotels sell.
- **Guest review requests** — on hold for contract reasons, correctly.

---

## What I would actually do, in order

| | Why it is first | Size |
| --- | --- | --- |
| **1. Analytics on the booking page** | Everything below is guesswork without it, and an owner cannot advertise a funnel they cannot see | Small |
| **2. Abandoned-booking recovery** | The data is already captured; ~80% abandon; one email | Small |
| **3. Language + currency display** | The reason a German guest closes the tab, and the euro changeover makes it sharper | Medium |
| **4. Cancellation terms a guest can read** | The question every direct booker asks before choosing direct | Small |
| **5. Promo codes** | The lever a hotel uses to justify the engine — and needed by (2) | Medium |
| **6. Real payments** | Stops being deferrable the day a real hotel takes a summer booking | Medium |
| **7. Revenue hints** | Derivable from data we already have; the most valuable sentence we could say | Medium |
| **8. Google Hotel Ads** | Biggest channel in the market, and pointless before there are hotels to feed it | Large |

⚠️ **None of this should start before a real hotel is using the product.** Every item above is a
guess about which gap that hotel will actually hit first, and the cheapest way to find out is to
watch one for a fortnight. The list exists so the answer is ready when they tell us — not so we can
start guessing today.

---

**Sources for the competitive picture:**
[RateGain — best hotel booking engines](https://rategain.com/blog/best-hotel-booking-engines/) ·
[Cloudbeds — booking engine guide](https://www.cloudbeds.com/articles/hotel-booking-engine-guide/) ·
[SiteMinder — booking engine](https://www.siteminder.com/hotel-booking-engine/) ·
[Track360 — Google Hotel Ads & metasearch 2026](https://track360.io/blog/google-hotel-ads-metasearch-marketing-for-hotels-operator-guide-2026) ·
[Hospitality Net — cart abandonment recovery](https://www.hospitalitynet.org/news/4128002) ·
[Revenue Hub — kill the promo code box](https://revenue-hub.com/kill-promo-code-box/)
