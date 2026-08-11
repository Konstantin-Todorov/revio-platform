# Channex live test — shot list

The recording plan, written so it can be re-shot cleanly rather than improvised. One take per
scenario, so a fumble costs one segment instead of the whole video. Segments are concatenated at
the end; if a segment is bad, re-record only that one.

**Everything happens in one Chrome window**, navigating between RevioCRS/RevioLink and Channex
staging. That is how a hotelier actually works, and it lets one screen recording show both sides.

## Fixed facts

| | |
| --- | --- |
| Channex property | `Test Property - Revio` · `a1e9b246-4db1-4ccd-aa8b-08dea7ff89f9` |
| Channex evidence screen | **Inventory** — `staging.channex.io/inventory?property_id=…`, jumped to June 2027 |
| PMS side | RevioCRS `reservation-production-f8c5.up.railway.app` · RevioLink `channel-manager-production-59bb.up.railway.app` |
| Demo dates | book **2027-06-10 → 06-11**, move to **2027-06-17 → 06-18** |
| Baseline | Twin AVL **8**, Double AVL **6** |

**Why June 2027:** November 2026 and 2026-12-01 → 2027-05-01 carry the certification restrictions
(test 8's half-year min stay), so a one-night booking there is correctly refused by our own booking
screen. June is clear and inside the priced horizon.

## Pacing — what stops it looking robotic

- **Land, then act.** After each navigation, pause ~1.5–2s before the first click, the way a person
  waits for a page to settle and finds what they are looking for.
- **Move the cursor in a path**, not a teleport: a few intermediate hover points before the click.
- **Read time on the payoff.** When the Channex number changes, hold still for ~3s. The reviewer
  needs to see it, and a human would look at it.
- **Scroll rather than jump** when something is below the fold, at a readable speed.
- No dead air longer than ~4s; trim it in post rather than leaving the viewer waiting.

## Segment 1 — booking pushes only its own night

1. Channex **Inventory**, June 2027 in view. Hold 2s on Twin = **8** on Thu 10.
2. Navigate RevioCRS → Reservations → New reservation. Dates 10 → 11 Jun 2027, 2 guests.
3. **Search** → Twin Room **Hold & continue** → first/last name → **Confirm reservation**.
4. Hold 2s on the confirmation (Twin Room, 2027-06-10 → 06-11).
5. Back to Channex Inventory → reload → **Twin 10 Jun now reads 7.** Hold 3s.
6. Pan across the neighbouring days to show 11–16 Jun are untouched at 8. *This is the point of the
   test: only the affected date moved.*

## Segment 2 — moving it a week pushes both weeks

1. RevioCRS reservation → **Modify stay** → arrival 17 Jun, departure 18 Jun → **Apply change**.
2. Hold on the timeline showing `2027-06-10 → 2027-06-11` struck through, replaced by 17 → 18.
3. Channex Inventory → reload → **10 Jun back to 8, 17 Jun down to 7.** Hold 3s, cursor resting on
   each in turn.
4. The nights in between never moved — worth lingering on, it is exactly what they asked to see.

## Segment 3 — full sync is two API calls

1. RevioLink → **Channels** → Channex Sandbox → **Sync now**. (A button in the UI, which is also
   their pre-call checklist item.)
2. Hold on the result: the Sync Center entry showing the window and both task ids —
   *availability task …* and *rates task …*, i.e. **two calls**, not one per date.
3. Channex Inventory → the whole horizon is populated.

## Segment 4 (only if sending for the call) — cancel

Reservation → **Cancel reservation** → Channex Inventory → 17 Jun returns to **8**.

## After recording

- Cancel the demo reservation so the property returns to the state Channex certified.
- **Do not touch November 2026** — Twin 21 Nov holds a booking, Double 25 Nov sits at inventory 1
  with a booking so it reads 0, min stay 2 restored on both cells for 25 Nov.
- Concatenate segments, then send with the property id to **evan@channex.io**, sharing set to
  "anyone with the link".

---

# How it is actually recorded

Worked out by doing it. These are the mechanics, not theory.

## Capture

```bash
cd recordings
screencapture -v -V <seconds> raw.mov     # must run in FOREGROUND of its shell
```

**It has to stay attached.** `screencapture -v ... &` with redirected output produces no file at
all — silently. Run it as a backgrounded *task* (so the shell stays its parent) and drive the
browser from separate calls while it records. `-V <seconds>` gives it a fixed duration, so plan the
segment length up front; it cannot be stopped early and cleanly.

Screen Recording permission is already granted on this machine.

## Compress

Raw capture is ~0.8 MB/second — 200s came out at 158 MB. Always render before sharing:

```bash
FF=~/"Work/Claude Projects/wasteops-demo/landing/node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg"
"$FF" -y -i raw.mov -vf "scale=1600:-2" -c:v libx264 -crf 26 -preset medium \
      -pix_fmt yuv420p -movflags +faststart -an out.mp4
```

158 MB → 6.8 MB, still perfectly legible. `-an` drops the (silent) audio track. There is no system
ffmpeg; the binary above comes from the wasteops project's node_modules.

## Driving the browser

One `browser_batch` per beat, so pacing is controlled rather than at the mercy of round-trip
latency. `wait` between steps, `hover` two or three intermediate points before each click so the
cursor travels instead of teleporting.

**The click quirk that will bite you:** on a freshly navigated page, the first click on a primary
button often only focuses the window — the page does not advance. A "warm-up" click elsewhere does
*not* reliably fix it. Budget for clicking the important button twice, and check with a screenshot
before moving on. This is why segments are short: a missed click is cheap to re-shoot.

## Channex side

Jump the inventory grid straight to the dates with a URL param — no clicking through the picker:

```
https://staging.channex.io/inventory?property_id=a1e9b246-4db1-4ccd-aa8b-08dea7ff89f9&date=2027-06-08
```

That frame shows 8–21 June, so 10 June and 17 June are both on screen at once — the booking date and
the moved-to date, with the untouched days between them visible in the same shot. **Channex
highlights a changed cell in amber**, which does the explaining for you.

## Coordinates that worked (1485×812 screenshot space)

| | |
| --- | --- |
| Channex Twin AVL row, 10 Jun | `(582, 311)` |
| CRS search, Twin **Hold & continue** | `(1386, 410)` |
| Booking form first / last name | `(427, 328)` / `(718, 328)` |
| **Confirm reservation** | `(1366, 665)` |
| Reservation **Cancel** / **Modify stay** | `(348, 481)` / `(340, 551)` |
