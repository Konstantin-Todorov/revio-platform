# Revio website sections — handoff pack

Everything needed to build these sections is **in this folder**. Nothing imports from outside it:
the sibling repositories are not assumed to exist.

## What this is

Marketing section artworks for reviosoft.app, each composed from **real product captures** — no
redrawn or invented UI. The compositions in \'compositions/\' are the source of truth; the PNGs in
\'rendered/\' are output. Change the composition, re-render — never retouch the PNG.

## Read first

1. \'manifest.json\' — machine-readable inventory: every artwork, its placement, its captures, its pixel size, and the background decision.
2. \'kit.css\' — the shared design language, lifted from the website's own tokens (\'src/styles/global.css\', \'BrowserFrame.astro\'). If the site's tokens change, change it here too.
3. \'compositions/*.html\' — ten working examples. Each is a standalone page on a fixed canvas, rendered at 2× by the same pattern: frame + optional callouts/detail inset on a stage.

## The captures

All in \'screenshots/\' (copied from the website repo's \'public/screenshots/\'; every file is 2880×1800, 16:10):

| Capture | Size |
| --- | --- |
| \'crs-calendar\' | 413 KB |
| \'crs-dashboard\' | 390 KB |
| \'crs-home\' | 427 KB |
| \'crs-reservations\' | 394 KB |
| \'direct-rooms\' | 377 KB |
| \'direct-search\' | 343 KB |
| \'link-calendar\' | 396 KB |
| \'link-channels\' | 304 KB |
| \'link-home\' | 385 KB |
| \'link-sync\' | 326 KB |
| \'platform-overview\' | 385 KB |
| \'pms-folio\' | 230 KB |
| \'pms-home\' | 381 KB |
| \'pms-housekeeping\' | 417 KB |
| \'pms-minibar\' | 229 KB |

## The artworks

### hero-one-core — One core, three products

- **Where it belongs:** Homepage hero
- **Placement:** Full width, under the headline. Replaces the single platform screenshot currently in `BrowserFrame`.
- **Captures used:** \'crs-dashboard\', \'pms-housekeeping\', \'platform-overview\'
- **Rendered (2×):** \'rendered/hero-one-core.png\' — 2400×1500

### product-link — RevioLink — annotated

- **Where it belongs:** RevioLink page
- **Placement:** Full width. Three callouts name the regions a buyer asks about before they book a call.
- **Captures used:** \'link-channels\'
- **Rendered (2×):** \'rendered/product-link.png\' — 2400×1500

### product-crs — RevioCRS — annotated

- **Where it belongs:** RevioCRS page
- **Placement:** Full width. Leads with the reservation record, not the analytics dashboard.
- **Captures used:** \'crs-reservations\'
- **Rendered (2×):** \'rendered/product-crs.png\' — 2400×1500

### product-pms — RevioPMS — annotated

- **Where it belongs:** RevioPMS page
- **Placement:** Full width. The front desk, where the shared record arrives.
- **Captures used:** \'pms-home\'
- **Rendered (2×):** \'rendered/product-pms.png\' — 2400×1500

### workflow-one-record — One shared record, three seats

- **Where it belongs:** Homepage — “How it works” band
- **Placement:** Full width, or in the half column beside the copy. Makes the composable claim a diagram instead of an assertion.
- **Captures used:** \'crs-reservations\', \'link-sync\', \'pms-home\'
- **Rendered (2×):** \'rendered/workflow-one-record.png\' — 2400×1500

### channels-one-calendar — Many channels, one calendar

- **Where it belongs:** RevioLink page — distribution
- **Placement:** Full width. The four channel nameplates drop into the layout and point at one screen.
- **Captures used:** \'link-channels\'
- **Rendered (2×):** \'rendered/channels-one-calendar.png\' — 2400×1500

### spotlight-housekeeping — Housekeeping, at 2×

- **Where it belongs:** RevioPMS page — housekeeping
- **Placement:** Full width. The magnified inset is the same capture, so the detail cannot drift from the board.
- **Captures used:** \'pms-housekeeping\'
- **Rendered (2×):** \'rendered/spotlight-housekeeping.png\' — 2400×1500

### record-guest-to-folio — The guest’s side and your side

- **Where it belongs:** RevioDirect page
- **Placement:** Full width. The strongest structural claim on the site, shown rather than described.
- **Captures used:** \'direct-search\', \'crs-reservations\'
- **Rendered (2×):** \'rendered/record-guest-to-folio.png\' — 2400×1500

### security-perimeters — Two perimeters

- **Where it belongs:** Security & trust page
- **Placement:** Full width or half column. ⚠️ A diagram, not a capture — it says so on the image.
- **Captures used:** none — a diagram, not a capture
- **Rendered (2×):** \'rendered/security-perimeters.png\' — 2400×1350

### og-platform — Social share card (2×)

- **Where it belongs:** og:image
- **Placement:** The 2× master, for anywhere that wants the retina file.
- **Captures used:** \'pms-home\', \'link-channels\'
- **Rendered (2×):** \'rendered/og-platform.png\' — 2400×1260


### og-platform-1200 — Social share card

- **File:** \'rendered/og-platform-1200.png\' — exactly 1200×630 (a 2× master is alongside)
- **Replaces:** the site's \'public/og/revio-og.png\'. Copy is baked in because a share card has no page around it.

## Decisions already made — keep them

- **Real UI only.** A screenshot may be cropped, framed, annotated, magnified — never redrawn. The magnified inset in the housekeeping artwork is the same capture scaled, which is why it cannot disagree with the screen it came from.
- **Honesty labels.** Diagrams that are not captures (security-perimeters) say so on the image. Screens arranged to show a flow say they are not one transaction. Demo figures are labelled "demo property".
- **Thin demo data is not marketing.** The CRS analytics dashboard's demo month is real but thin (1.6% occupancy); the artworks deliberately lead with the reservations record instead. Do not reverse this.
- **16:10 everywhere.** The site's frame media slot is \'aspect-[16/10]\' and every capture is natively 1.6. Anything else letterboxes or crops.
- **Window edges close between rows.** A view window onto a capture ends at a row boundary, never through one.

## The background — READ THIS ONE

The compositions ship with a near-black \'#0c0c0c\' grid-and-glow backdrop. **The site does not want it.**
It has its own background and these sections must sit on that, now; the dark stage can come back later as a deliberate choice.

What to do: keep frame chrome, callouts, detail insets and all layout exactly as they are; remove the 'stage backdrop layers' (the stage background gradients, the grid overlay and the glow blobs) so the pieces sit directly on the page's own background. Check every label colour still reads on it — the kit was written against near-black, so any label or caption that assumed #0c0c0c needs its colour re-derived from the site's real tokens, measured rather than eyeballed.

## Porting into the Astro site

The site already wraps every screenshot in \'BrowserFrame\' (product chrome + caption strip). Two ways to use these:

1. **Drop-in images.** Place a rendered PNG where \'BrowserFrame\' would appear (full-width sections), and skip the frame — the artwork already carries one. Aspect 16:10 matches the existing slot, so nothing shifts.
2. **Native sections.** Rebuild a composition as an Astro component (frames + callouts as markup), so callout labels stay real text. \'kit.css\' maps almost one-to-one onto the site's existing utility classes; the capture paths become \'/screenshots/…\' from \'public/\'.

Prefer (2) for anything with text baked in at artwork size — text in images is not translatable, not searchable and cannot be corrected after publication.

## Re-rendering (optional, on this machine)

From the platform repo root: \'node design/mockups/build.mjs\' (needs \'../revio-websites\' beside it — the pack removes that requirement for reading and porting, not for re-rendering).
