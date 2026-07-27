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

Nothing new to configure. Colour, logo and typeface are read from the fields the hotel already set
for its guest emails, so switching the engine on inherits a look rather than asking for one again.

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

## Boundaries

- Guest-facing domain logic lives in **`@revio/booking`**, not here, because the CRS's own public API
  routes use the same operations. An app never imports another app's internals.
- Availability and pricing come from the **same waterfall and rate plans** the staff screens use.
  There is no separate inventory and no sync — that is the product's whole structural claim.
- A booking writes the **one shared reservation record** tagged `source = Direct`, which is why it
  appears in RevioCRS and on the RevioPMS front desk with no integration step.
