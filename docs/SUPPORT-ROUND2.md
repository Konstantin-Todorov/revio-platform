# Support round 2 — founder review, 2026-09-07

Recorded from the founder's review of the shipped ticket centre. **Nothing here is built.** Each item
was checked against the code before being written down, so the next session starts from what is
actually there rather than from the report.

The one-line summary: the ticket centre records a conversation faithfully and then shows it badly,
and only one side can speak.

---

## 1 · The hotel cannot reply to our reply — the real hole

> *"in the crs pms cm they cant respond when we respond to them"*

`packages/ui/src/my-requests.tsx` renders the thread and **has no input of any kind** — no textarea,
no form, no button. A hotel can read what we said and cannot answer it. Their only route back is a
new request, which arrives as a separate case with none of the history attached.

**The model is already right.** `SupportMessage.side` exists and takes `hotel`, and the component
computes `awaitingUs = !last || last.side === "hotel"` and renders *"We have your reply — we aim to
reply within…"*. That branch is **unreachable today**: nothing can write a `hotel` message, because
creating a request does not create one either (production: 2 requests, 0 messages). The UI was
written for a reply the product cannot accept.

**What it needs:** a reply action on the hotel side, mirroring `replyToSupportRequest` in the
operator — same tenant gate as the rest of the app, writing `side: "hotel"`, and emailing us the way
ours emails them. Once that exists the "We have your reply" line starts being true.

⚠️ Reopening: a hotel replying to a request we marked handled should bring it back into the open
queue, or the answer lands where nobody is looking. Decide whether that clears `handledAt` or whether
"handled" becomes derived from whose turn it is — the component already derives turn-taking from the
thread and comments that *"a status column and a thread can disagree, and the thread is the one that
is true"*. That reasoning points at deriving it.

---

## 2 · Answering a request hides everything about it

> *"in the operator when its waiting i see from where it comes but when i answer i cant see the info
> and the other corespondation"*

Exactly right, and it is structural rather than a styling problem. `apps/operator/app/(protected)/
support/page.tsx` keeps two lists:

| | Open (`!handledAt`) | Answered (`handledAt`) |
| --- | --- | --- |
| Where it came from | shown | **gone** |
| The message thread | shown | **gone** |
| Reply box | shown | **gone** |
| What you get | the whole case | reference · hotel · first 90 characters · a date |

So the moment a case is answered it collapses to one line, and there is no way to read what was said
or to say anything further. The *Answered* card's own subtitle — *"Kept, because a renewal call asks
what they have reported before"* — describes a use it cannot serve: on a renewal call you would want
the correspondence, and the correspondence is the part that was dropped.

**What it needs:** answered cases keep source, thread and the ability to reply. The simplest honest
version is one card shape used in both states.

---

## 3 · The page needs a real structure — tabs, and a case you can open

> *"i cannot see the corespondation right the page needs to have tabs maybe"*

Everything lives inline on a single 250-line page: the log-a-call form, the open queue with full
threads expanded, and the answered list. With more than a handful of cases, or one long thread, it is
unreadable — and there is **no per-case view at all**, so nothing can be linked to, sent to a
colleague, or opened from a client's page.

**What it needs, in the order that helps most:**

1. **A case detail route** — `/support/[id]`: the hotel, the product, the screen, the person, where
   it came from, the full thread, the reply box, and the actions. This is what most of items 2 and 3
   actually want.
2. **Tabs on the queue** — *Open · Answered · All*, and the log-a-call form behind its own control
   rather than sitting above the queue permanently.
3. A link to the case from the client page timeline, so a renewal call reaches it.

---

## 4 · In the products, the cases are buried under the FAQ

> *"in the operator and in the help sections in the softwares it should have more info to be more
> tidy and easy to see now its in the botoom below the faq and the cases are hard to find"*

Confirmed in all three hotel apps — each `help/page.tsx` is literally:

```tsx
<HelpCentre … />     // 16 articles
<MyRequests … />     // everything you have asked us
```

Sixteen articles come first, so *"what did they say about my problem"* is below all of them. The
page's own docstring argues for one page rather than two — *"somebody who cannot find an answer is
about to ask, and somebody checking on a question they asked yesterday looks in the same place"* —
and that reasoning holds. **It is an ordering and prominence problem, not a splitting one.** An open
case the hotel is waiting on should be the first thing on the page; the FAQ is what you read when you
have no open case.

**What it needs:** open requests surfaced above the articles (or a compact "1 open request" band that
jumps to them), a count visible without scrolling, and the same treatment applied to the operator's
own help surface.

---

## 5 · More information in the help, in both places

> *"it should have more info to be more tidy and easy to see"*

Held deliberately separate from items 1–4, because those are defects and this is content. Related to
the earlier note that the FAQ could carry more answers — *"maybe we need to have more answered
questions with more content, but im not sure i am not demanding it"* — and to the standing decision
to let the real support queue say which articles are missing before writing more. Two support
requests exist so far, which is not yet evidence.

Revisit once the queue has enough in it to name the gaps.

---

## Suggested order

1. **The hotel's reply** (item 1) — it is the only functional hole; the rest is presentation.
2. **The case detail route** (item 3.1), which is most of what items 2 and 3 are asking for.
3. **Answered keeps everything** (item 2) — largely falls out of 3.1.
4. **Tabs** (item 3.2) and **cases above the FAQ** (item 4).
5. **More help content** (item 5) — when the queue justifies it.

Items 1–4 are one focused round. Item 5 is not, and should not be bundled into it.
