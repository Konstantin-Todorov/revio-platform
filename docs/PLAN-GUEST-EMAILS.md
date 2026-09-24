# Guest emails — what goes out, in which language, and what to change

**Status:** review written 2026-09-25 for the founder's question *"мейлите към клиентите на хотелите на
какъв език ще отиват… основно за CRS и за букинг енджина… и структурата на мейлите в CRS"*.
**Built 2026-09-25** after the founder's answers (*emails in every product, editable, in Bulgarian; CRS
confirmations by default; the language easy to find*): one shared Guest emails screen in RevioLink,
RevioCRS and RevioPMS (Settings → Guest emails) with the guest language first; RevioCRS sends
confirmation / change / cancellation; RevioPMS emails the bill at check-out; the stay block is written
in the email's language; the From name is the hotel's. **Still open:** pre-arrival and thank-you (need
the jobs runner), a per-guest language (`Reservation.guestLanguage`), staff mail in the staff member's
language, and a Bulgarian default for new Bulgarian properties.
Every claim names the file it was read from.

## 1. What actually sends today

| Email (template key) | Who sends it | Sent? |
| --- | --- | --- |
| Booking confirmation (`booking_confirmation`) | RevioDirect, when a guest books (`apps/booking/lib/actions-book.ts`) | ✅ only for bookings made on the booking page |
| Waitlist joined / offer / expired | RevioDirect + RevioCRS job (`actions-waitlist.ts`, `apps/reservation/lib/waitlist-emails.ts`) | ✅ |
| Booking modified (`booking_modified`) | nobody | ❌ defined, editable, **never sent** |
| Booking cancelled (`booking_cancelled`) | nobody | ❌ never sent |
| Pre-arrival (`pre_arrival`) | nobody | ❌ never sent |
| Thank-you after stay (`post_stay`) | nobody | ❌ never sent |
| Folio receipt (`folio_receipt`) | nobody | ❌ never sent |
| New reservation → the hotel (`reservation_delivery`), arrivals digest | RevioLink (`connectivity/src/sync.ts`, `jobs/arrivals`) | ✅ to staff, always English |

**A reservation typed into RevioCRS by staff sends the guest nothing** — no confirmation, no change, no
cancellation. (A Booking.com booking correctly sends nothing: the OTA mails its own guest.)

## 2. Which language

The rule in the engine (`packages/email/src/engine.ts`) is right: **the guest's language → the hotel's
default → English.** In practice the first step never happens:

- **No screen records the guest's language.** RevioDirect passes `property.defaultLanguage`, not the
  guest's; the booking page itself is English-only (`apps/booking/app/layout.tsx`, `lang="en"`).
- **`Property.defaultLanguage` defaults to `"en"`**, and the only place to change it is **RevioLink →
  Settings → Guest emails** ("Make Български the default for guests").

So today: **every guest email goes out in English unless somebody pressed that button in RevioLink.**
A Bulgarian hotel with the default untouched sends English mail to Bulgarian guests.

## 3. Faults found while reading

1. **The guest-email editor exists only in RevioLink.** A hotel that runs RevioCRS without RevioLink —
   the product that owns reservations and the booking page — cannot see, edit, brand or switch the
   language of the mail its own booking page sends. RevioCRS → Booking Engine even says its colours
   "follow your email branding", which a CRS-only hotel has no way to open.
2. **The editor offers five emails that never send.** A hotel can carefully write a pre-arrival note
   and switch it on, and no guest ever receives it. That is a promise the screen makes and the product
   does not keep.
3. **A Bulgarian confirmation has an English middle.** The stay details block is hard-coded English in
   `actions-book.ts` — "Reference", "Room", "Check-in … from 14:00", "Total to pay at the hotel" — with
   ISO dates (`2026-10-24`) and English money (`€195.00`), inside a Bulgarian email.
4. **Emails to staff ignore the staff's language.** The new-booking and arrivals mails are English even
   for a receptionist who chose Bulgarian (`User.locale`).

## 4. Proposal

**A. One "Guest emails" screen, in whichever product owns the booking.** Move the editor into a shared
component (the way Billing is shared) and show it in **RevioCRS → Settings** — the system of record —
and keep it in RevioLink for a RevioLink-only hotel. Same data, same rows; nothing to migrate.

**B. Ordered by the guest's journey, and honest about what sends.** Group the list as the stay happens:
*Booking* (confirmation · change · cancellation) → *Before arrival* → *After the stay* (receipt ·
thank-you) → *Waitlist*. Each row says in one line **when it goes out and from where** ("When a guest
books on your booking page"), and an email with nothing wired to it says **"Not sent yet"** instead of
offering a switch. Language completeness per row ("BG ✓ · EN ✓").

**C. Actually send the missing ones, in this order:** confirmation / change / cancellation for
reservations made or edited in RevioCRS (with a "Send the guest a confirmation" tick, on by default,
because a phone booking sometimes should not be mailed); the receipt at RevioPMS check-out; then
pre-arrival and thank-you on the jobs runner.

**D. Language, properly.**
- Record **`Reservation.guestLanguage`**: on RevioDirect from the page language (and the browser until
  the page is translated); in RevioCRS a field on the booking form, defaulted from the guest's
  nationality (BG → Bulgarian); from a returning guest's last stay.
- A **new property in Bulgaria starts with Bulgarian as its default** (a property has no country field; its `timezone`, `Europe/Sofia`, is the signal, or setup asks);
  first-run setup asks the question in one line. Existing hotels are not changed silently.
- The details block, dates and money are written in the email's language (fixes fault 3).
- Staff mail follows the staff member's `User.locale`, as our own account mail now does.

## 5. Decisions for the founder

1. Guest emails in **RevioCRS Settings** (and RevioLink keeps its copy)? — recommended: yes.
2. Staff-made RevioCRS reservations send a confirmation **by default**, with a tick to skip it? —
   recommended: yes.
3. New Bulgarian properties default to **Bulgarian** guest mail? And the real clients already live —
   ask them, or switch? — recommended: default for new, ask the existing ones.
4. Build order: **3 → C (CRS confirmations) → A+B → D** — recommended, because fault 3 is a visible
   bug on the live booking page and C is the biggest gap for a CRS-only hotel.

---

## 6. Who sends what — checked for duplicates and gaps (2026-09-25)

The founder asked: *do the emails RevioLink sends overlap with RevioCRS's or RevioPMS's; with one
product, does every needed email still arrive; with all three, is nobody mailed the same thing twice?*
Read from the code, event by event:

| Event | Guest receives | Team receives | With all three products |
| --- | --- | --- | --- |
| Booking on Booking.com / Expedia | nothing from us — **the OTA confirms**; a second confirmation reads as a second booking | "N new bookings" — **only if the hotel runs RevioLink alone** (`deliverNewBookings`); with RevioCRS or RevioPMS it is on their screens instead | one import, no mail to the guest, no mail to the team |
| Booking on the hotel's booking page | confirmation (RevioDirect) | nothing — it is in RevioCRS | once |
| Booking typed into RevioCRS | confirmation (tick, on by default) | — | once |
| Change / cancellation in RevioCRS | "changed" / "cancelled" (tick) — never for an OTA booking | — | once |
| Walk-in, room move, extension in RevioPMS | nothing (the guest is at the desk) | — | — |
| Check-out in RevioPMS | the bill (tick; one-click check-out sends it when there is an address) | — | once |
| 3 days before arrival / morning after departure | "Before arrival" / "After departure" — **off until the hotel switches them on**; the job stamps each stay once | — | once, whichever product the booking came from |
| A booking that could not be imported | — | "A booking is not in your calendar" (once per failed booking) | once |
| Daily arrivals list | — | at the hotel's chosen time, once a day | once |

**One gap found and fixed:** bookings that arrived by the **Channex webhook** (seconds) never
produced the "new bookings" email — the webhook imported them, so the five-minute pull found nothing
new and sent nothing. A RevioLink-only hotel with the webhook on was never told about a booking. All
three import paths now call one function, `apps/channel-manager/lib/booking-delivery.ts`. The manual
"pull now" and the scheduled pull also used to word the same email two different ways.

**By design, not a gap:** a hotel running RevioCRS or RevioPMS gets no "new booking" email — it sees
the booking in the product it works in, and the email would be the duplicate. If a hotel ever asks
for both, it is a setting to add, not a default to change.

## 7. Languages — the rule (see `packages/ui/CLAUDE.md` § "Bulgarian is the first translation")

- **Guests** get the hotel's guest language (Settings → Guest emails). Base is English; a new hotel
  starts in English. *Proposed, not built:* start a new property in the language of the person who
  creates it — a hotel set up by someone working in Bulgarian begins with Bulgarian guest mail, and
  one set up in English keeps English.
- **The team** gets its own language: `teamLocale` — the reader's panel language where the address is
  a user's, else the owner's. New bookings, the arrivals list and import failures follow it.
- **The panel** is each person's own (`User.locale`), and the Guest emails screen says so where the
  product offers the switch — the list shows each email's real subject in the guests' language, so
  the two are never confused.
