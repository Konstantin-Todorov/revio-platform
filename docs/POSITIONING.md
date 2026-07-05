# Revio — Product Positioning & Website Content

> Source material for the marketing websites. **Four sites planned:** one **general** site (what the
> platform is + routes to each product) and three **product** sites (RevioLink, RevioCRS, RevioPMS).
> **Every product site carries a small "the rest of the platform" section** that upsells the other two.
> All copy below is grounded in what is actually built and live — no vaporware.

---

## 0. The platform in one line

**Revio is a composable line of hotel software that shares one inventory core.** Buy one product today,
add the others whenever you're ready — with **zero migration**, because they were one system all along.

- **RevioLink** — Channel Manager (distribution: OTAs in sync)
- **RevioCRS** — Central Reservation System (the booking record + real performance numbers)
- **RevioPMS** — Property Management System (running the property day-to-day)

The edge over all-in-one suites (Mews, Cloudbeds) and pure channel managers (SiteMinder): **land with one
product, expand into the others without re-onboarding, re-importing, or re-training.** One login, one set of
rooms and rates, one availability truth.

---

## 1. RevioLink — Channel Manager

**Tagline:** *One true availability. Every channel in sync. No more overbookings.*

**What it is:** A distribution engine that keeps your availability, rates and restrictions identical
everywhere you sell — pushing changes out to the OTAs and pulling bookings back, in real time.

**Key functions**
- **Availability, Rates & Restrictions (ARI) sync** to every connected channel — one edit, everywhere.
- **Two-stream mapping** (room types → inventory/open-close, rate plans → rates/restrictions) that mirrors
  how the OTAs actually work.
- **Calendar & Bulk Update** — change a night, a week, a season across rooms and rates at once.
- **Derived rates** — set one rate, let Non-Refundable / Breakfast / Mobile rates recalculate automatically.
- **Restrictions** — min/max stay, stop-sell, closed-to-arrival/departure, advance-purchase.
- **Sync Center & Error Center** — a live push/pull feed and a prioritized, actionable problem list.
- **Real connectivity via Channex** (Booking.com, Expedia, Airbnb, and more), behind a swappable adapter.

**Best selling points**
- **You physically cannot double-book** — there is one availability number, and it's the one every channel
  sees. Overbooking is engineered out, not patched over.
- **Instant, not scheduled** — an edit propagates immediately; you're never waiting on a nightly job.
- **Built to expand** — the same rooms and rates power RevioCRS and RevioPMS the day you add them.
- **Honest error handling** — a booking that can't be mapped is never dropped; it's surfaced for you to fix.

**Conveniences**
- Works on desktop and mobile.
- A mock mode means the whole ARI loop is demonstrable before any OTA paperwork.
- Per-channel connectivity health (last-24h delivery %), logos, quick actions (re-sync, open/close, pull).

**Ideal buyer:** a hotel that already has a PMS/booking system and just needs its channels kept in sync.

---

## 2. RevioCRS — Central Reservation System

**Tagline:** *Every booking, one record — and real numbers you can trust.*

**What it is:** The system of record for **every** reservation, from any source, plus the performance
metrics computed from that record. It answers *"how is the property actually selling?"*

**Key functions**
- **Reservations** — create, modify, cancel, with a proper lifecycle and an instant **Hold** that locks
  inventory the moment a room is selected (call-center-grade overbooking prevention).
- **Availability Search** — a guest-stay query across every room type at once, with alternative and upgrade
  suggestions, flowing straight into a booking.
- **The availability waterfall** — physical rooms − out-of-order − closed − holds − confirmed, in one place.
- **Rates & Restrictions** — 4-level priority (manual → rule → rate-plan → property default), scoped by
  booking source (e.g. closed to Travel Agents, open to Direct).
- **Metrics that come from the truth** — Occupancy, ADR, RevPAR, Pickup, Cancellation, LOS, Lead Time —
  one formula sheet powering both the Dashboard and Reports (with CSV export).
- **Guests, Booking Sources, Taxes & Fees, Global Search, an Action Center and a Forecast.**
- **Distribution via one Connected Channel Manager** — RevioLink by default, or your existing CM.

**Best selling points**
- **Numbers from the source of truth, not a spreadsheet** — RevPAR and pickup are computed from the actual
  reservation record, so revenue decisions rest on real data.
- **Holds stop the double-booking at the point of sale**, before the form is even saved.
- **Modifications are safe by design** — the new dates are validated before the old inventory is released;
  a bad change never leaves you exposed.
- **One connected CM, never a tangle of OTA logins** — per-OTA work stays in the channel manager.

**Conveniences**
- Nightly pickup snapshots stand up from day one (you can't backfill history you never captured).
- Permission groups (8 areas × view/edit) so roles are configuration, not code.
- Responsive shell; global search from anywhere.

**Ideal buyer:** a property that wants a clean booking record and real performance analytics — with or
without heavy OTA needs.

---

## 3. RevioPMS — Property Management System

**Tagline:** *Run the property. Every room, every day.*

**What it is:** The operations layer — front desk, housekeeping, folios, minibar, maintenance — that turns
reservations into stays. It answers *"how is the property being run today?"*

**Key functions**
- **Front Desk** — arrivals / departures / in-house, check-in with **room assignment**, check-out, room
  move, and one-screen **walk-ins** (create a same-day booking and check the guest straight in).
- **Housekeeping board** — Clean / Dirty / Inspected / Out-of-Order per room, floor-grouped, with a live
  occupancy overlay — designed for a phone (PWA), not just the front desk.
- **Folio & Billing** — one bill per stay, drawn from the reservation rate, with charges, taxes/fees, and
  payments recorded as labels; a **settle-at-check-out** gate so nobody leaves with an open balance.
- **Minibar / POS** — a chargeable-item catalog with mobile **tap-to-post** straight to the guest's folio.
- **Maintenance** — a task board where flagging a room out-of-order takes it off sale everywhere.
- **Close Day** — a manual night audit that marks no-shows and rolls the business date.

**Best selling points**
- **The one thing operations touches, the whole platform knows** — mark a room out-of-order in
  housekeeping or maintenance and it instantly leaves sale on every OTA (via the shared availability core).
- **Sells as an operations layer even over a foreign system** — you don't have to replace what you have.
- **Mobile-first housekeeping** — status changes and minibar posting from a phone, no reception terminal.
- **No card data, ever** — payments are recorded as labels/amounts; there's nothing sensitive to breach.

**Conveniences**
- The bill matches the reservation revenue exactly (same source), so PMS and reporting never disagree.
- Hotels sell rooms; hostels sell beds — the same unit model covers both.
- Walk-ins, room moves and check-outs are two clicks.

**Ideal buyer:** a property that needs to run daily operations — as a full system or a layer over an
existing reservation platform.

---

## 4. Cross-sell blurbs (the "rest of the platform" section on each product site)

Each product site ends with a short section (2 cards) upselling the other two. Keep it light — the hook is
always *"it's already the same system."*

**On the RevioLink site → upsell CRS + PMS**
- **RevioCRS** — "Turn synced channels into real numbers. Every booking in one record, with Occupancy, ADR
  and RevPAR computed from the truth. Already sharing your rooms and rates — switch it on, no migration."
- **RevioPMS** — "Run the property, not just the channels. Front desk, housekeeping and folios on the same
  inventory — a room going out-of-order leaves sale everywhere, automatically."

**On the RevioCRS site → upsell Link + PMS**
- **RevioLink** — "Push your availability to Booking.com, Expedia and more — kept in perfect sync, no
  double-bookings. Your CRS already holds the rooms; Link just distributes them."
- **RevioPMS** — "Give your bookings a front desk. Check-in, housekeeping and folios that read the same
  reservation record — no re-keying, no second guest list."

**On the RevioPMS site → upsell Link + CRS**
- **RevioLink** — "Fill the rooms you're cleaning. Distribute to every OTA from the same inventory your front
  desk manages — an out-of-order room comes off sale instantly."
- **RevioCRS** — "See how you're really selling. Real Occupancy / ADR / RevPAR and pickup from the same
  reservation record your front desk works from."

---

## 5. The general (platform) site

**Hero:** *Hotel software that grows with you.* — one composable platform, three products, one shared core.

**The three, in a line each:**
- **RevioLink** — keep every channel in sync, never overbook.
- **RevioCRS** — one booking record, real performance numbers.
- **RevioPMS** — run the property day-to-day.

**The pitch (why composable wins):**
1. **Start where it hurts** — buy the one product you need now.
2. **Add the rest with zero migration** — they already share your rooms, rates, and availability. Flipping on
   a product is a switch, not a project.
3. **One login, one truth** — no syncing between your own systems, no re-training, no double entry.

**Primary CTAs:** three buttons routing to the product sites (Link / CRS / PMS). Secondary CTA: "See how it
fits together" → the composable story.

---

## 6. Proof points (shared, usable on any site)

- One shared inventory core — a single availability number across distribution, reservations, and operations.
- Real OTA connectivity via Channex (certification-ready), behind a swappable adapter.
- Multi-tenant with Postgres Row-Level Security — a hotel physically cannot see another's data.
- Money handled as integer minor units; **no card data stored anywhere** in the platform.
- Live today: all three products + the operator console, each on its own service, one shared database.

> **Tone:** confident, concrete, founder-honest. Lead with the anti-overbooking / one-truth story and the
> land-and-expand economics. Avoid buzzwords; every claim above maps to a shipped feature.
