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

`lib/brand.ts` derives three tokens from the single hex the hotel gave us:

| Token | Job |
| --- | --- |
| `--brand` | Fills — the button, rules, dots. |
| `--brand-ink` | Text **on** the fill. Computed from relative luminance, because a pale gold needs dark text and a navy needs white. |
| `--brand-text` | Brand-coloured text **on paper** — darkened to stay readable. A mid-lightness colour makes a fine button and an unreadable headline; one value cannot do both jobs. |

## Design direction

Hotel stationery, not SaaS: warm paper ground, hairline rules, editorial headings (Fraunces),
generous air. That is a practical choice as much as an aesthetic one — the page wears a **different
hotel's colour on every visit**, so the canvas has to be quiet enough that any accent looks
deliberate on it.

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
