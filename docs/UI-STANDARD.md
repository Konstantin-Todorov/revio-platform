# The UI standard

**Every screen we ship is held to this. It is not a style guide — it is a bar.**

> *"The UI is super important everywhere and in every new feature we build. It needs to be like the
> best in the niche. Do it so it is easy to understand to every human."* — founder, 2026-09-08

A hotel does not choose software by reading its architecture. A receptionist at 7am with a queue in
front of them, a housekeeper on a phone, an owner checking last night's revenue — none of them will
read a manual, and none of them should have to. **If a screen has to be explained, it is not
finished.**

---

## The rule that produced this file

The support thread shipped as a correct, well-tested, unreadable list: every message in one column
behind a grey rule, the question that started it rendered somewhere else entirely, and the only way
to tell who was speaking was to read a name on each line. Nothing was broken. It was simply hard,
and *"super hard to get track of it"* is a defect even when every test passes.

**Correct is not the same as usable, and only one of them is what a customer experiences.**

---

## 1 · Borrow the shape people already know

The strongest UI decision available is almost always *"which familiar thing is this?"* — then look
like that thing, closely enough that nobody has to learn it.

- A conversation looks like **WhatsApp / Messenger / Viber**: sides, bubbles, grouping, day dividers.
- A calendar looks like a calendar. A folio looks like a bill. An inbox looks like an inbox.
- A booking flow looks like every other booking flow a guest has ever completed.

Departing from the familiar shape is allowed, but it has to buy something specific and be written
down. Novelty for its own sake costs a person time they did not agree to spend.

## 2 · Say it before it is read

The eye takes position, colour, size and grouping before it takes words. Put the meaning there.

| Instead of | Encode it as |
| --- | --- |
| a `side: "hotel"` label on each line | which side of the thread it sits on |
| a "status" column | a pill whose colour means the same thing everywhere |
| a date on every row | a day divider, once, when the day changes |
| repeating the author on five consecutive messages | say it once per run |

Colour alone is never the whole signal — it also has to survive being printed, screenshotted, and
looked at by somebody who cannot distinguish it. Say it in words *as well*.

## 3 · One component per concept

A concept rendered twice will diverge, and the second copy is always the one that loses something.

This is not theory here. The support case was two pieces of markup — waiting and answered — and the
answered one had quietly lost the source, the whole conversation and the reply box. The fix was one
`SupportCase` used by both. The thread is one `SupportThread` used by **both sides**, with a
`perspective` flag, for exactly the same reason.

**If two screens show the same thing, they share a component or they will lie to each other.**

## 4 · Every state is designed, not just the happy one

Empty, loading, error, one item, four hundred items, and the longest string a real customer will
type. The empty state is the one most often forgotten and the one a **new customer sees first** — a
bare table header on a fresh install reads as a screen that failed to load.

An empty state says what to do next, in words, with the control nearby.

## 4b · When something goes wrong, the screen tells the customer what it means for THEM

Rule 4 asks for an error state to exist. This is what it has to say, and it was written after an
incident rather than before one.

On **2026-09-15** a hotel connected its property and made a test booking to watch it arrive. The
booking was sold under a rate plan with no channel id, so RevioLink refused to guess which room it
meant — correctly; guessing is how two guests arrive for one room — and parked it. The platform then
told her, in order: nothing by email, a reservation page with a dash in every field, and a timeline
reading *"No events recorded for this reservation yet"* while the Error Center held the cause to the
second. She waited fifteen minutes, concluded bookings were being lost, and **disconnected her
channel**.

Nothing was broken. Every refusal was right. She left because of what the screens said.

**Four rules, in this order:**

1. **Lead with the consequence, not the cause.** "Your channel mapping is incomplete" describes our
   problem. "This booking is not in your calendar and the room is still on sale" describes theirs,
   and it is the sentence that makes somebody act today instead of tomorrow.
2. **Name the exact control, and check it is the right one.** Both the error and the email first said
   "Re-sync" — which only *pushes* and cannot bring a booking back. Telling a customer to press a
   button that cannot work costs more than saying nothing.
3. **Never let a screen imply data was lost when it was not.** A hotel that believes we drop bookings
   disconnects its channel. Say where the thing is being held and what brings it back.
4. **A status with a known cause must never render as silence.** Dashes in every field and "no events
   recorded" is a screen asserting we do not know, when we do.

⚠️ And the corollary that caused the lasting damage here: **a recovery control must not be gated on
something the customer can dismiss.** Re-import was shown only while an error was unresolved, so
pressing *Resolve* — which imports nothing — hid the one button that recovers the booking. Gate
recovery on the FACT (a booking with no stay), never on whether anybody has tidied a notice.

## 5 · Write for the person, not the schema

- Their vocabulary, never ours. A person manages **notifications**, not `webhook config`; they see
  **Rooms**, not `Unit`. (`copy-lint` enforces this — it fails the build on internal vocabulary in
  user-visible strings.)
- A control says what will happen: *Publish* → *Published*.
- An error says what went wrong **and** what to do about it. No apologies, no blame, no stack.
- Numbers say what they are. A figure nobody can explain is a figure nobody trusts.

## 6 · It has to work on the device it is used on

Front desks are shared terminals; housekeeping is a phone in one hand. Every screen is used on both.

- 16px inputs on touch, so iOS does not zoom (`zoom-lint`).
- Visible keyboard focus on everything focusable (`a11y-lint`).
- Real touch targets, wrapping headers, tables that scroll in their own container rather than
  pushing the page sideways.
- `prefers-reduced-motion` respected.

## 7 · Look at it

Typecheck, tests and eleven lints all pass on a screen nobody can read — that is precisely how the
linear thread shipped. **Before a UI change is finished, open it in a browser and look at the
rendered page**, with content long enough to be realistic.

Doing that on this very change caught a bug in the first minute: the "mine" bubbles had no
background at all, because `tokens.ts` mirrors the shade as `"050"` and every app's Tailwind config
calls it `50`. Nothing failed. It was just invisible.

## 8 · Where you are on the left, what you are doing on top

**Set by the founder on 2026-09-25, after Guest emails:** *"подредбата табове в ляво и после отгоре
двете са топ, много ми харесва така — запиши го"*. The shape:

- **Sections on the left** — the areas of a screen that you navigate between and that each hold
  something different (Settings: Property · Guest emails · Team · Billing; Help: Articles · Your
  requests). One shared component: `SettingsNav` in `@revio/ui`, with `prefix: true` when a section
  has pages below it, so the left stays lit while you work inside it. On a phone it becomes a
  scrolling row of chips at the top — same component, nothing to rebuild.
- **Tabs on top** — the different *views of the one thing* the left says you are in (Guest emails:
  Emails · Look & sender; Extras & Charges: Charge a guest · Catalog; Folios: Open · Receivables ·
  History). Links, not client state: each tab is a URL, so it can be bookmarked, sent in a support
  answer and opened in a new tab.
- **The decision that changes everything below it sits above the tabs** (Guest emails: which
  language guests receive). Asked first, because it changes what every row means.
- **A list, then one thing** — a row opens the thing on its own page inside the same frame (Your
  requests → one conversation; Guest emails → one email's editor), never an accordion of editors.
- **That one thing gets tabs too when it is long** (RevioCRS Rooms & Rates, 2026-09-25: a room type
  is Basics · What a guest reads · Photos · Rate plans). The founder's objection to the first,
  stacked version was the tell: *"по средата има някъв бутон за сейв, а след това страницата
  продължава"*. **A save button is the last thing in its card, and nothing it does not save comes
  after it.** A tab carrying a warning a guest would notice shows a dot before it is opened.

⚠️ **Not at a front desk.** Tabs were rejected on the folio screen and the reason stands (see
`apps/pms/CLAUDE.md`): at a desk you do not know in advance which tab you need, and a tab you never
open is a feature you never learn exists. The shape is for places a person comes to *set something
up*, not for a queue with a guest waiting. `docs/UI-GROUPING-AUDIT.md` lists which screens take it.

**Reordering is by drag and drop, everywhere** (founder, same day: *"навсякъде … да е с драг и
дроп"*). One component, `SortableList` in `@revio/ui/sortable`: pointer events so it works on a phone,
the row you hold stays under your finger while the others glide out of its way, one save per drop,
and the handle takes ↑/↓ (←/→ in a grid) from the keyboard. Never up/down arrow buttons. When an
order carries meaning — the first photo is the cover — say it in words above the list, mark the
first item unmistakably, and give a one-click way to put something first ("Make cover").

---

## The check, before calling a screen done

1. Would somebody who has never seen it know what to do, without being told?
2. Is it shaped like the familiar thing it is?
3. Can you tell who/what/when **without reading** the words?
4. Does anything here exist twice? Should it be one component?
5. Empty, error, one, many, and a very long value — all designed?
6. Does it work on a phone, with a keyboard, and at 200% zoom?
7. **Have you actually looked at it?**

---

## Where this is enforced

Prose does not hold a bar; the ratchets do. `copy-lint` (vocabulary) · `a11y-lint` (focus) ·
`zoom-lint` (touch sizing and pinch-zoom) · `scroll-lock-lint` (modals) · `health-lint` (no
hardcoded green). They exist because each of these was got wrong once. **When a UI rule is worth
keeping, it earns a lint** — see `docs/GAP-REGISTER.md`.
