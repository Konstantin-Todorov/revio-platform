# Package: UI (`@revio/ui`)

> Part of the **Revio platform** — read the root `CLAUDE.md` first.

Shared design tokens and the handful of components more than one app needs. Tokens are derived from
the **Atlas** design direction in `design/Direction A - Atlas.dc.html`: navy chrome, blue/green/amber/
red status colours.

- `src/tokens.css` — CSS custom properties (the source of truth for colour/space/radius).
- `src/tokens.ts` — the same values for TS/Tailwind consumption, **plus `productAccents`**.
- `src/amenity-icon.tsx` — icon name → icon component for the room-content vocabulary in
  `@revio/core`. Typed `Record<RoomIconName, LucideIcon>`, so adding an amenity to core without an
  icon here is a **build error**, not a room that quietly renders a generic tick.

Keep all colour usage going through tokens — no hardcoded hex in app code — so a palette swap is one
file.

⚠️ **The Tailwind class is `-50`, not `-050`.** `tokens.ts` writes the lightest shade as `"050"` (a
string, so the key order stays readable) while every app's `tailwind.config.ts` registers it as `50`.
`bg-brand-050` is therefore not a class, and Tailwind says nothing — the element simply renders with
no background. It shipped exactly once, in the support thread's own bubbles, and was caught by
looking at the page rather than by any check.

## ⚠️ This package is where the UI bar is held — `docs/UI-STANDARD.md`

Every shared component here is used by three or four products at once, so a shortcut taken here is a
shortcut taken everywhere. Before adding or changing one:

- **Borrow the shape people already know.** `support-thread.tsx` looks like WhatsApp because a
  support case *is* a conversation and everybody already reads one of those. It did not, once, and
  the feedback was *"super hard to get track of it"* — from a screen with no bugs in it.
- **One component per concept, shared by every surface.** `SupportThread` takes a `perspective` so
  the hotel and the operator read the *same* conversation from their own side. Two implementations of
  one concept diverge, and the second always loses something — that has happened here twice.
- **Look at the rendered page** before calling it done. Tests and lints pass on screens nobody can
  read.

## Brand: one platform, four identities

The founder's marks live in `design/brand/` (source PNGs). Each app serves its own resized copies:
`apps/<app>/public/mark.png` (the sidebar mark) and `apps/<app>/app/icon.png` + `apple-icon.png`
(the favicon, picked up automatically by the Next App Router).

**A brand mark is never re-drawn by eye.** The marks are used as delivered; only the Operator tile is
synthesised, by mapping the RevioLink tile's accent to white so it keeps the exact silhouette and
corner radius of the real artwork.

| App | Accent (`product.mark`) | Text on white (`product.ink`) |
| --- | --- | --- |
| RevioLink | cyan `#24d3ee` | `#0e7490` |
| RevioCRS | indigo `#818cf8` | `#4f46e5` |
| RevioPMS | emerald `#34d399` | `#047857` |
| Operator | white — **no product colour** | navy `#0e203c` |

Three roles because one hex cannot do all three jobs: `mark` is the accent **on the navy chrome** and
belongs only there; `ink` is the same hue darkened until it reads as text on white (every value is
measured ≥ 4.5:1); `wash` is the tint behind a selected row.

**Where the accent is allowed**: the sidebar mark, the rail beside the active nav item, the wordmark
tail, the account avatar, the favicon, and selected-chip states. That is the whole list, and it is
deliberately short — the founder asked for "something small… so you know where you're at", not a
repaint.

**Where it is not.** Primary buttons stay `brand-800` navy in **all four** apps. RevioPMS is the
reason this is written down: it had made `accent` its primary action colour, and swapping that to
emerald put a `bg-accent-600` button beside the housekeeping board's solid green `bg-success-600`
"Finish" button — two near-identical greens meaning "primary action" and "done". Its `accent` scale
now mirrors `brand`, and the emerald lives in the chrome only.

**Operator has no accent on purpose.** It is the platform, not a product, so the slot where a product
colour would go is left empty — which is also the fastest way to tell you are on the operator
perimeter and not inside a hotel's own app.

**RevioDirect is absent entirely.** The booking page wears the *hotel's* brand colour (computed per
property in `apps/booking/lib/brand.ts`) and the hotel's own logo as its favicon. Painting Revio's
identity on a guest-facing page would contradict the product.
