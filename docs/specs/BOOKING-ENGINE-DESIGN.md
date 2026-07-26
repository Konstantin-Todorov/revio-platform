# RevioDirect — Booking Engine design

> Design proposal, 2026-07-26. Governed by the founder's `BOOKING-ENGINE-ADDENDUM.md` (2026-07-09),
> which remains binding on placement, boundaries and sequencing. This document adds the *how*:
> what the market does, where Revio can beat it structurally, and a build plan.
> **Status: awaiting founder sign-off. Nothing here is built.**

---

## 0. The dependency is now met

The addendum deferred the build behind one hard prerequisite — the payment gateway (§4). That
boundary shipped in phase F2 (Stripe **test mode**). The three mandatory seams (§6) are also in
place and verified:

| Seam (addendum §6) | Where it lives now |
| --- | --- |
| Availability-search + reservation-create callable unauthenticated | `apps/reservation/lib/public-engine.ts` — `publicAvailability()`, `publicCreateReservation()` |
| `source = Direct` on the reservation | `BookingSource` category `direct`, written by the seam |
| "Bookable on the direct channel" flag on rate plans | `RatePlan.directChannelEnabled` |

So this is no longer blocked on architecture. It is blocked on a decision, and on **live** Stripe
keys (today the platform holds test keys only — see §7).

---

## 1. What the market actually does

Research summary (sources at the end). The category is mature and mostly undifferentiated:

- **Conversion is the whole scoreboard.** Industry average sits at **2.5–3.5%**; a well-optimised
  engine reaches **4–5%**, and the best-claimed reach ~5.5%. Everyone sells on this number.
- **Abandonment is caused by friction, not price.** The recurring causes are: too many steps
  (~22% abandon because checkout takes too long), **hidden fees appearing late**, payment-security
  doubt, slow pages, and unanswered basic questions (parking, pets, accessibility, bed configuration)
  that send the guest off-site to find the answer — and into an OTA.
- **Mobile is the majority.** ~70% of hotel bookings happen on a phone.
- **Personalisation is the 2026 differentiator**, and it is explicitly *PMS-data-driven*: engines that
  can read past-guest history claim 5–8% conversion lift plus higher ancillary revenue.
- **Total-price transparency** is repeatedly named as the trust lever that beats OTAs.

The honest read: most engines are a widget bolted onto a PMS by an integration. Their weaknesses —
sync lag, no guest history at the moment of booking, fees revealed late — are **consequences of not
owning the core**.

---

## 2. Where Revio wins structurally

This is the part a competitor cannot copy without rebuilding their platform. Each of these is a
direct consequence of the one-database, one-inventory-core rule in the root `CLAUDE.md`.

**① The availability number is the same number.** A direct booking writes to the identical waterfall
the OTAs are pushed from — no sync job, no lag window. It is not "fast sync"; it is *no sync*. The
guest-visible promise: the room shown is genuinely available, and booking it takes it off Booking.com
in the same instant. Competitors with a PMS↔engine integration have a window, however small, where
both can sell the last room.

**② We know the guest before they type anything.** The PMS already stores stay history, preferences
(`Guest` + `GuestNote`, with the n≥2 preference guard) and the merged guest identity. A returning
guest can be recognised from their email at step one and offered *their* usual — the quiet floor, the
high floor, the late checkout they always ask for. This is the exact 2026 differentiator the market
is chasing, and we get it for free because the guest record is already shared.

**③ The total price is knowable, exactly, at step one.** The CRS owns VAT and city-tax rules
(`TaxFee`, `cityTaxMode`) and the PMS owns the folio those rules produce. So the engine can show the
true all-in total on the first screen instead of discovering it at checkout — the single most-cited
abandonment cause, structurally removed rather than mitigated.

**④ Commission-free, and provably so.** Because the CRS computes source/channel mix, the hotel can
see direct vs OTA revenue *and the commission it did not pay* on the same dashboard. The engine
doesn't just drive direct bookings; it proves their value in the analytics we already ship.

**⑤ One less vendor.** The engine, the channel manager, the reservation record, the folio and the
invoice are one system. Nothing to reconcile.

**Positioning line:** *the only booking engine that shares its inventory with the channel manager
instead of syncing to it.*

---

## 3. Design principles

1. **Three steps, never four.** Dates & guests → choose room → confirm & pay. Everything else is
   progressive disclosure.
2. **No account, ever, to book.** Email is the identity. Account creation is an *offer after*
   booking, never a gate before it.
3. **Total price on screen one.** Including VAT and city tax, itemised on hover/tap. No number ever
   increases as the guest moves forward — that is a hard invariant, not a guideline.
4. **Mobile-first, literally.** Design the 375px layout first, then let it grow. Thumb-reachable
   primary actions.
5. **Answer the off-site questions in place.** Parking, pets, accessibility, bed setup, check-in
   times — surfaced on the room card, because a guest who opens a new tab is a guest lost to an OTA.
6. **The hotel's brand, not ours.** Reuse the email-engine branding model already built (logo,
   colour, typeface, theme) so the widget matches the hotel's site out of the box.
7. **Speed is a feature.** Server-rendered, no client-side data waterfall, availability in one query.
8. **Honest scarcity only.** "2 rooms left" only when 2 rooms are genuinely left. No countdown
   theatre, no fake "12 people viewing". This is a trust product; fake urgency is how OTAs are
   *distrusted*, and it would undermine ①.

---

## 4. The flow

### Step 1 — Dates, guests, and the truth about price
Calendar with per-night prices already visible (we have them). Guest/occupancy picker. On submit,
availability in one round trip via `publicAvailability()`.

### Step 2 — Choose a room
Cards per room type: photos, the answers from principle ⑤, remaining count (honest), and the rate
plans flagged `directChannelEnabled`. Each plan shows the **all-in total for the stay**, plus the
per-night breakdown and the cancellation terms in plain language.

*Returning-guest layer:* if the email is known, the card set re-orders to their history and shows a
quiet "You stayed in a Deluxe Double last September" note. Never creepy, never a discount they didn't
earn — recognition, not surveillance.

### Step 3 — Confirm and pay
One screen. Guest details (name, email, phone), any stay extras, payment via the existing gateway
boundary, and the total that has not changed since step 1.

**Hold-then-confirm:** the room is held the moment step 3 opens (the CRS `Hold` with TTL already
exists), so a guest filling in a card cannot lose the room to an OTA mid-checkout. The TTL countdown
is shown honestly. This is ① made visible.

### After
Confirmation email through the email engine already built — the hotel's branding, the guest's
language, Bulgarian included. Reservation appears in CRS Reservations tagged `source = Direct`, and
in PMS Front Desk as an arrival, with no further integration.

---

## 5. What it is NOT (V1)

Explicitly out, to keep the surface honest and shippable:

- No loyalty programme or member rates (a later, separate decision).
- No multi-property search (the addendum's optional §6 note — design for it, don't build it).
- No upsell engine beyond the stay-extras the PMS already defines.
- No A/B testing framework.
- No AI concierge chat.

---

## 6. Build plan

Phase **K**, after founder sign-off. Estimated shape, not a commitment:

| Task | What |
| --- | --- |
| K1 | Public app shell — a new Next app (`apps/booking`, port 3004) or a public route group on the CRS. **Recommend a separate app**: it is the only internet-facing, unauthenticated surface and deserves its own deploy, its own error budget and its own security posture. |
| K2 | Step 1 — calendar + availability, all-in pricing from the tax rules |
| K3 | Step 2 — room cards, honest scarcity, the off-site answers, room-type content model (photos, amenities) |
| K4 | Step 3 — hold-on-open, guest details, gateway payment, confirm |
| K5 | Returning-guest recognition (email → shared guest record, opt-out respected, GDPR-clean) |
| K6 | CRS Distribution → booking-engine settings: enable, branding, which rate plans, deposit policy, embed snippet |
| K7 | Direct-vs-OTA analytics incl. commission saved |
| K8 | Verify + deploy |

**Prerequisites before K4 can go live for a real hotel:** live Stripe keys (§7), a sending domain
(#127) for the confirmation email, and — for Bulgaria — the fiscalization decision from `F3`.

---

## 7. Risks and honest constraints

- **Payments are test-mode today.** The platform holds Stripe *test* keys by deliberate policy. A
  real hotel taking real deposits needs live keys and the associated compliance/PCI posture review.
  This is the single largest gap between this design and revenue.
- **Room-type content doesn't exist yet.** We store commercial data (name, code, occupancy) but no
  photos or amenity copy. A booking engine cannot sell a room it cannot show. K3 must add a content
  model — this is real, unglamorous scope that is easy to underestimate.
- **Public surface = new threat model.** Unauthenticated, internet-facing, money-taking. Needs rate
  limiting, bot protection on the search endpoint, and abuse controls on hold-creation (a trivial
  script could otherwise hold a hotel's entire inventory). **Hold-abuse protection is a K1
  requirement, not a K8 nicety.**
- **Conversion claims are vendor-marketed.** The 5.5% figures come from vendors selling engines.
  Treat them as direction, not as a target we promise a hotel.

---

## Sources

- [8 Best Hotel Booking Engines for 2026 — RateGain](https://rategain.com/blog/best-hotel-booking-engines/)
- [Internet Booking Engine for Hotels: A 2026 Buyer's Guide — RateGain](https://rategain.com/blog/internet-booking-engines-for-hotels/)
- [10 Best Hotel Booking Engines 2026 — Hotel Tech Report](https://hoteltechreport.com/marketing/hotel-booking-engine)
- [Top 10 Best Booking Engines for Hotels in 2026 — TechMagic](https://www.techmagic.co/blog/best-hotel-booking-engine)
- [Hotel Conversion Rate Benchmarks 2026 — Roomstay](https://www.roomstay.io/blog/optimising-hotel-average-conversion-rate)
- [Why Do Guests Abandon Hotel Bookings? — Hotel Online](https://www.hotel-online.com/news/why-do-guests-abandon-hotel-bookings-what-every-hotelier-needs-to-know)
- [Hotel Booking Abandonment: Why Guests Leave — HiJiffy](https://www.hijiffy.com/resources/articles/hotel-booking-abandonment)
- [Direct booking in 2026: Personalization, AI visibility and experience — Hospitality Today](https://www.hospitality.today/article/direct-booking-in-2026-personalization-ai-visibility-and-experience)
- [How to Increase Direct Bookings for Hotels in 2026 — Mews](https://www.mews.com/en/blog/increase-hotel-direct-bookings)
- [What is a Hotel Booking Engine? The Complete 2026 Guide — Cloudbeds](https://www.cloudbeds.com/articles/hotel-booking-engine-guide/)
