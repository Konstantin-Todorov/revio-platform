# Channex live test — the recording script

**All 12 certification tests passed (2026-08-11).** What remains is a live demonstration: a short
video showing three actions in RevioLink/RevioCRS and the matching updates arriving in Channex.

Send the link plus the property id to **evan@channex.io**. Sharing must be "anyone with the link" —
they will not chase an access request.

| | |
| --- | --- |
| **Property id to quote** | `a1e9b246-4db1-4ccd-aa8b-08dea7ff89f9` (`Test Property - Revio`, staging) |
| **PMS side** | https://channel-manager-production-59bb.up.railway.app · RevioCRS at https://reservation-production-f8c5.up.railway.app · property **Revio Cert Hotel** |
| **Channex side** | staging.channex.io → the property → **Messages / Logs** |

> **Two of the three are already certified behaviour.** Scenario 1 is certification test 9 and
> scenario 3 is test 1, both passed. Only the **modify** is new, and it is the one worth rehearsing.

---

## Before you press record

**Pick dates that are not restricted, or the booking will be refused.** The cert property carries
the certification data: **November 2026** is full of test restrictions, and **2026-12-01 → 2027-05-01**
is test 8's half-year block with min stay 2 (Twin) and 3 (Double). A one-night booking in either
window is correctly rejected by our own booking screen.

**June 2027 is clear** and inside the 500-day priced horizon. This script uses **2027-06-10**,
moving to **2027-06-17**. Any clear week works — just avoid the two windows above.

Have both tabs open side by side: RevioCRS on one, the Channex property's Messages/Logs on the
other. The reviewer wants to see the action *and* its effect, so keep both visible.

---

## Scenario 1 — a booking pushes only its own night

RevioCRS → **Reservations → New reservation** → arrival `2027-06-10`, departure `2027-06-11`,
2 guests, 1 room → **Search** → Twin Room **Hold & continue** → name → **Confirm reservation**.

Then Channex → Messages/Logs. **Expected: one availability row — Twin, 2027-06-10, and nothing
else.** No rates, no restrictions, no other dates.

*Rehearsed 2026-08-11:* `Pushed 2/2 updates · 2027-06-10 → 2027-06-10 (1 days)`.

## Scenario 2 — moving it a week pushes both weeks

On the reservation → **Modify stay** → arrival `2027-06-17`, departure `2027-06-18` → **Apply change**.

**Expected: two availability rows — Twin 2027-06-10 back up (the night released) and Twin
2027-06-17 down (the night now taken). Nothing for the six days in between.**

This is the one Channex is really asking about, and it is worth saying out loud while recording:
the released night is pushed as well as the taken one, because a night we stop occupying is a night
the channel may now sell.

*Rehearsed 2026-08-11:* `Pushed 4/4 updates · 2027-06-10 → 2027-06-17 (2 days)` — the two dates,
not the range between them.

## Scenario 3 — full sync is two API calls

RevioLink → **Channels → Channex Sandbox → Sync now**.

**Expected: exactly 2 calls — one availability, one rates & restrictions**, each covering the
property's full sync horizon (500 days).

*This is certification test 1, already passed with ids `1f05a5d5…` (availability) and `cfc73e27…`
(rates).* The button is on the Channels screen, which also answers their pre-call checklist item
"prefer it is a button in UI to trigger it".

## Also worth recording if you book the call instead

The call checklist adds **cancel**. Same reservation → **Cancel reservation** → expect one
availability row restoring Twin on 2027-06-17. Same delta discipline as the modify.

---

## Cleaning up afterwards

Cancel the demo reservation so the property goes back to the state Channex certified. **Do not touch
the November 2026 data** — Twin 21 Nov holds one booking, Double 25 Nov sits at inventory 1 with one
booking so it reads 0, and min stay 2 is restored on both the room-wide and BAR cells for 25 Nov.

## If you need to inspect a push

```bash
pnpm --filter @revio/connectivity channex:task <task id>
```

**Channex expires task records within hours** — an id certified in the morning already returns
`resource_not_found` by the evening. Inspect a push while it is fresh. The durable record on our
side is the SyncEvent (Sync Center → Logs), which keeps the window and the task id.
