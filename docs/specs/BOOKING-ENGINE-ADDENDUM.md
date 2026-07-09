# RevioCRS — Booking Engine (Addendum: placement & sequencing)

> Founder spec, received 2026-07-09. Source: "Booking Engine Ad on (mandatory).docx". Build deferred; the three design-for-now seams (§6) are MANDATORY in the current cycle.

A short addendum to the RevioCRS guide covering the one surface the suite hasn't placed yet: the booking engine — the "Book now" widget on the hotel's own website that takes direct reservations. This note settles where it lives, which boundaries it respects, its one hard dependency, and — most important for right now — the design requirements to honour today so it isn't blocked later, even though the build itself is deferred.

## 1. What it is

The booking engine is the hotel's direct sales channel: a guest-facing widget that searches availability, shows rooms and rates, takes a reservation, and (usually) collects a deposit or prepayment. It is the commission-free counterpart to the OTA channels.

## 2. Where it lives — the CRS direct channel, not a fourth product

The booking engine is a surface on RevioCRS, not a new product and not part of RevioLink.

The reasoning follows rules already set in this guide: the CRS owns commercial reservation origination and sells room types against the shared availability core. A booking engine is simply another origination surface — the same category as a call-centre booking or a manual reservation, both of which the CRS already handles. So it is a thin guest-facing front-end onto the CRS's existing availability-search and reservation-create logic, writing into the same one reservation record (the one-record rule, §1.3 of the main guide).

It is not a system with its own inventory. Building it with a separate booking-engine availability table that syncs against the core would reintroduce exactly the two-tables-syncing problem the suite is designed to avoid.

In-app placement: within the CRS, the booking engine is managed under Distribution — the same section that holds the channel-manager connection and CRS↔CM mapping. This is deliberate: Distribution is "how rooms reach the market," and the direct channel is one of those routes. So the OTA channels (via the channel manager) and the direct channel (the booking engine) sit side by side in one place. The booking engine's setup lives here — enable/disable, branding, which rate plans are exposed to it (the direct-channel flag, §6.3), and its payment settings — while the resulting reservations flow into Reservations like any other source.

Deployment note: the booking engine requires the CRS. It is available in the integrated deployment (CRS present), not in RevioLink-standalone (where there is no CRS reservation record).

## 3. Boundaries it respects

- Reads availability and rates from the shared core — the same availability waterfall and the same rate plans the CRS already exposes. No separate inventory.

- Writes a reservation into the one shared-core record, tagged source = Direct, following the normal lifecycle (Confirmed, or Hold → Confirmed with a TTL).

- Bypasses RevioLink / Channex entirely. RevioLink is for OTA connectivity; the direct channel writes straight to the core. This is correct and it's a selling point: a direct booking hits the same availability number instantly, so it can never oversell against an OTA booking — and it carries no OTA commission.

- City tax follows the CRS rule (§4.4 of the main guide): the booking engine displays/collects per the property's payable-on-spot vs included setting. Because a direct booking is paid to the hotel, the tax treatment is the hotel's own — no OTA disclosure step is involved.

- Payment runs through the payment-gateway boundary (the same one specced for PMS deposits), never a payment integration of its own.

- No mapping — only selection. Unlike the OTA channels, the direct channel needs no mapping layer. Mapping exists to reconcile two systems' identifiers for the same thing (the CRS's "Deluxe Double" ↔ Booking.com's room #12345); it's required only where the CRS talks to a system it doesn't own. The booking engine reads the CRS's own room types and rate plans directly, by their own IDs — there is no second vocabulary to translate. What replaces mapping here is a one-sided visibility choice: which existing rate plans and room types are switched on for the direct channel (the "bookable on the direct channel" flag, §6.3). It's a show/hide toggle on records the CRS already owns, not a this-equals-that correspondence table.

Rule of thumb: mapping is needed wherever the CRS talks to a system it doesn't own (OTAs via the channel manager, or a third-party channel manager); it is not needed wherever a surface reads the shared core directly (the booking engine, the PMS, internal staff screens). The booking engine is on the second side of that line — hence selection, not mapping.

## 4. The one hard dependency — the payment gateway

A booking engine that takes a deposit or prepayment at the moment of booking needs to charge a card, which means it depends on the payment gateway boundary. That boundary is being built for PMS deposits; it is the unlock for the booking engine. Until the gateway is live, the booking engine can't take payment — which is most of its value. So the gateway is a prerequisite, and the booking engine reuses it rather than reinventing it (tokenised, no card numbers stored — same principle as the rest of the platform).

## 5. Sequencing recommendation — defer the build, decide it as when, not if

Recommendation: build it after the three products land and the payment gateway is live for PMS deposits — not in the current cycle.

Why defer:

- Surface area at the wrong moment. Three products are built and about to be refined against real screens, with a Bulgaria/EU launch that hinges on fiscalization working. A public-facing, payment-taking new surface widens scope exactly when the priority is proving the core.

- Highest-stakes thing to get wrong. It faces guests and it takes money, so bugs cost real bookings and real trust — unlike an internal screen staff can work around.

- Hard dependency. It can't take payment until the gateway exists (§4).

Why it's a when, not an if: it's the commission-free direct channel, it completes the CRS story ("real performance numbers" is stronger when you also drive direct revenue), and it's the piece that makes Revio look like a complete platform rather than three back-office tools. The gateway work already planned for PMS deposits is what makes it cheap to add later — origination (CRS) and payment (gateway) will both already exist, leaving mostly the guest-facing front-end.

## 6. Design-for-now — three things to honour today so it isn't blocked later

Even while deferring the build, keep the CRS design from walling it out. This is the same "design the seam now, build the connector later" discipline applied to external POS and fiscalization:

- Make availability-search and reservation-create callable by an external, unauthenticated caller (the public widget) — not only by internal, authenticated staff screens. A clean API seam onto those two operations is all that's needed; without it, the booking engine forces a later refactor.

- Carry source = Direct (booking engine) in the reservation model now, alongside the existing OTA and manual sources — so direct bookings are first-class in reporting (source/channel mix) from day one.

- Add a "bookable on the direct channel" flag to rate plans. Some rates are OTA-only or corporate-only and must not appear on the public widget; this is the direct-channel equivalent of channel mapping, and it belongs in the rate-plan model. Design it in now even if nothing consumes it yet.

(Optional, lower priority: design so a booking engine can be per-property or expose multiple properties for a group later — consistent with the group/portfolio direction in §4.1 of the main guide.)

## 7. When built — scope sketch (later phase, not now)

For reference, so the deferred work is understood:

- Guest-facing widget: availability calendar, room-type + rate-plan selection, guest details, payment step (gateway), confirmation.

- Public-facing weight the internal tools don't carry: design quality, mobile-first, localisation (language + currency), accessibility.

- Confirmation email; Hold-then-Confirm with TTL for abandoned checkouts.

- Direct-channel performance feeds the CRS source/channel mix analytics (direct vs OTA), closing the loop on "drive and measure direct revenue."

### Glossary (addendum)

- Booking engine — the guest-facing widget on the hotel's own website that takes direct reservations; a surface on the CRS, not a separate product.

- Direct channel — the hotel's own booking path (website widget, call centre, walk-in origination), commission-free, writing straight to the shared core without going through RevioLink/Channex.

- source = Direct — the reservation-source value marking a booking that originated on the direct channel, alongside OTA and manual sources.