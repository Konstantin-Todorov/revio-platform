# App: Booking Engine — product name **RevioDirect** (`@revio/booking-app`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first. Design + locked decisions:
> `docs/specs/BOOKING-ENGINE-DESIGN.md`. Port **3004**. **No auth — this is the public surface.**

The hotel's own booking page at `book.revio.app/<publicSlug>`. A guest arrives from the hotel's
"Book now" button, an Instagram bio or a QR code at reception, and books without an account.

## What makes this different from the other three apps

Every other app is behind a login and serves staff. This one is **unauthenticated, internet-facing
and inventory-touching**, which changes the rules:

- **There is no session, so there is no tenant context** until a slug resolves. `lib/property.ts` is
  the single choke point that turns a public slug into a property, using the system perimeter
  deliberately; everything downstream scopes to the tenant it returns.
- **Every "no" looks identical.** Unknown slug, engine switched off, suspended tenant, inactive
  property → one generic 404. Distinguishing them would leak which hotels are Revio customers and
  which stopped paying.
- **Abuse protection is a feature, not hardening.** A hold takes a room off sale for its TTL, so an
  unthrottled create-hold endpoint lets a script take a small hotel's whole inventory off every
  channel. `@revio/booking`'s rate limiter caps holds per IP *and* per property — the second one is
  what survives a distributed attempt. Tested, not assumed.
- **The page is not indexed.** `robots: noindex` — the hotel's own marketing site should rank, not
  our checkout, and a stray index would compete with the client we built this for.

## Branding

**Configured in RevioCRS → Booking Engine** (`apps/reservation/app/(protected)/booking-engine/`),
NOT in the email settings. The booking page and the confirmation email are two different pieces of
the hotel's identity, and a shared control means editing one silently restyles the other.

Every `booking*` column on `Property` is nullable, and **NULL means "inherit from the email
branding"**. So switching the engine on still inherits a coherent look with no second round of
branding work, and only the fields a hotel actually edits diverge. The resolution lives in one place
(`lib/property.ts`) — screens never read the raw columns.

A hotel picks a **base preset** (`BOOKING_PRESETS` in `@revio/core`) and then edits colour, headings,
logo and hero copy on top of it. A preset sets ONLY neutrals and shape, never the accent — that is
always the hotel's own colour. That separation is what makes "pick a base, then edit" compose: the
two choices cannot fight each other. The presets live in core because both the public page and the
CRS's live preview render from them, and a preview that approximates the result is worse than none.

`lib/brand.ts` derives five tokens from the single hex the hotel gave us:

| Token | Job |
| --- | --- |
| `--brand` | Fills — the button, the current step, the calendar selection. |
| `--brand-ink` | Text **on** the fill. |
| `--brand-text` | Brand-coloured text on a light ground — a headline, a link, a badge. |
| `--brand-wash` / `--brand-soft` | Tints — badges, the hero gradient, nights inside a selected range. |

**Contrast is measured, never assumed.** Both `--brand-ink` and `--brand-text` are found by walking
the colour down one percent at a time until it *actually measures* 4.5:1, rather than by clamping
lightness. Lightness and perceived luminance are not the same thing: a fixed cap that passes
comfortably for a navy fails at 2.6:1 for a gold. Two consequences worth knowing:

- **Dark ink is preferred when it works**, so a sky blue stays sky blue and a yellow stays yellow
  instead of being darkened into something the hotel would not recognise. A hotel's exact hex is
  usually rendered untouched.
- **The fill also has a separation floor** against the card behind it — near-white brand colours
  carry black text perfectly well and still vanish into the page, which the label check alone
  cannot catch.

`lib/brand.test.ts` runs every assertion across twelve deliberately awkward hotel colours. That file
exists because a real WCAG failure shipped here once; "it looked fine on the demo hotel" is not
evidence when the page wears an arbitrary colour on every visit.

## Design direction

**Calm precision.** This page asks a stranger for their name and their card, so clarity outranks
decoration at every fork: white surfaces on a cool near-neutral ground, one shadow family, generous
radii, and hierarchy carried by weight and spacing rather than ornament.

The neutrals are near-achromatic on purpose — the page wears a **different hotel's colour on every
visit**, and the brand colour must be the only saturated thing on screen. That is what lets a navy,
a gold and a forest green all look deliberate on the same canvas, and it makes the primary action
impossible to miss, from the same decision.

**Type:** Plus Jakarta Sans does nearly all the work — its numerals matter more here than anywhere
else in the platform, because this page is a column of prices a guest reads by comparing them.
Instrument Serif appears only for hotels that chose a serif identity, and only for headings.
**Prices never take the hotel's display font** (`.price`): money is data, not brand voice.

**Interaction patterns are the ones real booking engines converged on**, for reasons rather than
fashion — a two-month date-**range** calendar (a native date input cannot express a range), a guest
stepper, a search bar that stays pinned to the results and collapses to one row on mobile, and a
four-step progress bar so nobody wonders how much is left.

**Honest scarcity only.** "2 rooms left" only when 2 rooms are genuinely left. No countdown theatre,
no "12 people viewing". Fake urgency is how OTAs became distrusted, and it would undermine the one
claim here that is genuinely unusual — that the availability is real.

## Room photos

Uploaded in **RevioCRS → Rooms & Rates → Room photos**, because a photograph belongs to the ROOM,
not to the page that happens to display it — the same image will feed the OTA push and the
confirmation email later, and moving it then would be a migration.

Bytes live in object storage (`@revio/storage`), never in Postgres; only keys are in
`RoomTypePhoto`. Every upload is re-encoded with `sharp` into two WebP variants (1600px card/gallery,
480px thumbnail) — hotels upload 6 MB phone photos, and re-encoding also means we never serve back
the exact bytes a stranger handed us. EXIF orientation is applied then stripped, because browsers
disagree about whether to honour it.

With no configuration the **local-disk driver** is used and everything works; a bucket is an
environment variable away (`DEPLOY.md` → Object storage). A relative storage dir resolves against the
**workspace root**, not the process cwd — otherwise RevioCRS would write to `apps/reservation/.storage`
and RevioDirect would 404 reading `apps/booking/.storage`.

**No photo is a designed state, not a failure.** A room with no photograph renders a brand-tinted
panel and its name, size and inclusions. A hotel can go live before its photo shoot; nothing about
launching is blocked on content.

## The booking flow (K4)

`search → /book → /booking/<reference>`. Four steps, and the guest can always see which one.

**Hold-on-open.** Reaching step 3 takes the room off sale for 15 minutes, before a single field is
typed. Without it two guests fill in the last room at once and one fails *after* entering their
details — the worst possible moment. A hold is cheap to release and expires by itself; a
double-booking is not recoverable. The hold id lives in the URL so a refresh reuses it instead of
taking a second room, and `loadStayContext` excludes the guest's OWN hold when they confirm —
otherwise the person holding the last room is told there is none.

**Nothing is re-used from the previous page except identifiers.** The stay is re-quoted on step 3
and again on submit, so a tab left open for an hour books today's price, and a tampered hidden field
changes what is booked rather than what is paid.

**No card fields exist.** The guarantee is created through `@revio/payments`, which is mock-first
and accepts only `sk_test_` keys — a live key is refused by construction. We store a token plus
brand/last4 (`Reservation.guarantee*`), never a number. Collecting a real card would need Stripe
Elements and a live-mode decision; both are deliberately out of scope, which is why the page can
honestly say *your card details never reach us*.

**The countdown is real.** The room genuinely is held and genuinely is released at zero. Everything
else on this site is honest, so a fake timer here would cost all of it.

The confirmation email uses the hotel's own template and branding through `@revio/email` — the same
engine RevioLink sends from — and never blocks the booking: the room is already theirs, and a mail
provider having a bad minute must not turn a completed reservation into an error page.

**Step 3 has an extras slot** (see the comment in `BookingForm`). Upsells belong there, after the
room is chosen — never beside the price on the results page, which would undermine the one promise
the product makes.

## Boundaries

- Guest-facing domain logic lives in **`@revio/booking`**, not here, because the CRS's own public API
  routes use the same operations. An app never imports another app's internals.
- Availability and pricing come from the **same waterfall and rate plans** the staff screens use.
  There is no separate inventory and no sync — that is the product's whole structural claim.
- A booking writes the **one shared reservation record** tagged `source = Direct`, which is why it
  appears in RevioCRS and on the RevioPMS front desk with no integration step.
