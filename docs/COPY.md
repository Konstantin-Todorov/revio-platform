# Product copy — the convention

> Applies to the four **staff** apps: RevioLink · RevioCRS · RevioPMS · Operator.
> `apps/booking` (RevioDirect) is excluded — it is guest-facing and wears the *hotel's* brand, so it
> keeps a warmer voice. Same reason it carries no Revio identity.

Written after a pass in August 2026 found ~106 page and card subtitles that explained **our
architecture** to people who had asked how to run **their hotel**.

## The voice: plain and instructional

> Say what the screen does for the hotel, and what to do next.

Not chosen because it is safe. Chosen because it carries no idiom, so it survives translation when
i18n lands, and because a receptionist reading a screen at 7am on a Sunday is not looking for our
opinion of our own data model.

## Four rules

**1. Never name our internals.** No *precedence model*, *waterfall*, *tier*, *cell*, *push*,
*derived*, *source of truth*, `@revio/core`, `§` spec references. These are true, and they are ours.

> ❌ "Standing policy defaults — the catch-all tier"
> ✅ "Applied when nothing more specific is set"

**2. Never explain how it is stored or computed** unless the hotel has to act on it.

> ❌ "calculated from reservations + inventory — never stored separately"
> ✅ *(nothing — the numbers are the point of the screen)*

**3. Never defend a design decision.** The customer did not question it, and raising it makes them
wonder whether they should.

> ❌ "contact details + booking history — deliberately not a CRM"
> ✅ "Contact details and booking history"

**4. Never reference what is coming later.** "Production adds…", "not yet", "for the demo", "V2".
A hotel paying for the software is not interested in a version it does not have.

> ❌ "Sync is in-process for the demo (no external queue yet)"
> ✅ "Sync runs inside the application, so queue depth and retry backlog are not measured"

## What stays

A subtitle that helps someone **make a decision** is doing its job. Keep it.

- "The first photo of each room is its cover."
- "Printed on QR codes and pasted into bios, so treat it as permanent once you share it."
- "Whether a guest gets an instant confirmation, or sends you a request to accept."

The test is not *is this explanatory* — it is *does a hotelier act differently for having read it*.

## Two traps found during the pass

**Truthful bad copy cannot be fixed by rewording.** The staff-invite screens said "Demo: password
`revio1234`; production sends an invite link". Deleting "demo" makes the sentence *read* better and
leaves the fact untouched: every invited user really does get the same known password, and cannot
change it. The copy was honest; the **feature** is the problem. Reworded to state the fact plainly
and left flagged for **N2 (invite + reset flow)**, which is the actual fix.

**"Demo" sometimes means something real.** `Tenant.isDemo` badges in the Operator console are not
dev-speak — they are the mechanism that keeps fake hotels out of MRR (see `apps/operator/lib/demo.ts`).
Those stay. So does the honest "no Stripe key is configured" state: rewording it is fine, claiming a
live connection is not.

## Vocabulary

| Concept | Say | Not |
| --- | --- | --- |
| `connectivityMode: mock` | **Test connection** | Mock (demo) · demo (mock) · simulated |
| `connectivityMode: channex_sandbox` | **Channex — test** | Channex sandbox |
| A room that cannot be sold | **Out of order** | OOO, blocked cell |
| Prices/availability leaving the system | **Sent to the channels** | pushed, ARI push |

Connectivity labels come from `connectivityModeLabel()` in `@revio/core` — one definition, because
four screens across three apps had each invented their own.
