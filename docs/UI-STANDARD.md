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
