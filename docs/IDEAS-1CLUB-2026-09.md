# Ideas from 1club — adapted for Revio (2026-09-03)

Source: a competitive read of **1club.ai** (`admin.1club.ai`), an AI-native club/gym management
platform, reviewed read-only in a demo org. Different domain — tennis, padel, martial arts — but the
**same shape** as us: multi-tenant B2B SaaS, bookings against finite resources, memberships,
payments, and a consumer-facing portal. Their "court at 18:00" is our "room on the 14th".

This file is the tracker. Each item states what they do, what it becomes **here**, and why. Nothing
is adopted because they have it; several things are rejected below with reasons.

Status: ☐ open · ◐ in progress · ☑ done

---

## What they run on, and what we should NOT copy

| | 1club | Revio |
| --- | --- | --- |
| Frontend | React + **Vite** SPA, client-rendered | 5 × Next.js App Router |
| Hosting | Vercel (fra1) | Railway, one Postgres |
| API | Node/**Express + Helmet**, REST `/v1` | Server actions + `@revio/core` |
| Tables | **MUI X DataGrid** | Hand-rolled tables |
| Analytics | **PostHog EU** (session replay, surveys) | GA4 on the marketing site only |
| Auth | OAuth + passwordless | email + bcrypt + JWT |

⚠️ **Do not copy their foundations.** A client-rendered SPA with a separate Express API is a simpler
architecture than ours, not a better one — we have DB-enforced RLS, one shared inventory core and
server-side authorization on every write. They also ship a **Replit dev banner into production**,
which is the kind of detail that tells a buyer what stage a product is at.

What is worth taking is **product surface and interaction design**, which is what follows.

---

## P0 — build these, in this order

### ☐ 1. Waitlist — `docs/specs/WAITLIST.md`

They have three transactional templates: *Waitlist Joined*, *Waitlist Spot Available*, *Waitlist
Expired*. **We have no waitlist at all.**

For a hotel this is not a nicety, it is recovered revenue: a sold-out date is demand we currently
answer with alternative stays and then forget. A cancellation later re-opens the room and nobody is
told.

We are unusually well placed to build it because **every primitive already exists** — the
availability waterfall, the `Hold` mechanism with a TTL, the hold-expiry job, and a branded email
engine. See the spec.

### ☐ 2. Guest feedback + review requests — `docs/specs/REVIEW-REQUESTS.md`

They prompt happy members to post public Google reviews and route unhappy feedback privately to
management. Hotels live or die on Booking.com and Google scores, and we already send `post_stay`.

⚠️ **We will NOT copy the mechanism.** Selectively soliciting public reviews from happy guests only
("review gating") is against Google's own review policies and is treated as a deceptive practice by
consumer-protection regulators. The spec describes a version that gets the same commercial benefit
**without** gating, and says plainly why.

### ☐ 3. Settings information architecture — sections → tabs

Their Settings is **12 sections down the left, tabs across the right**, deep-linkable
(`/settings/organization/details`). Organization alone carries Details · Subscription · Users ·
Permissions · Notifications · Domains · APIs & webhooks.

Our CRS Settings is **one long scrolling page**: standing policy defaults, permission matrix, taxes
and fees, property profile, pricing model card, 2FA. It has outgrown a single page.

**This is an IA change, not a feature** — no new capability, a large jump in perceived quality, and
it makes every future setting have an obvious home. Proposed sections:

`Property` · `Rates & policies` · `Taxes & fees` · `Booking engine` · `Emails` · `Users & permissions`
· `Billing` · `Integrations` · `Your account`

Keep URLs deep-linkable so a support answer can be a link.

---

## P1 — the differentiators

### ☐ 4. Scoped AI agents — refines phase P3

Their assistant is **not one chatbot**. It is six agents, each declaring its scope, each with example
prompts:

| Agent | Boundary |
| --- | --- |
| Booking & Check-in | creates bookings, checks members in (**write**) |
| Data & Insights | answers about data (**read**) |
| Configuration | edits settings and entities (**high-privilege write**) |
| Communication | finds members, prepares messages |
| Help & Docs | *"I don't change anything"* (**read-only, stated**) |
| Website Builder | edits their public site |

Plus a **Conversation History** tab, and a persistent **⌘K** bar on every screen.

`BUILD-PLAN.md` P3 specifies **one** assistant. Splitting it into named agents with declared
read/write boundaries is better on two axes at once: a user learns what it can do without
experimenting, and the dangerous half is separable from the safe half. It fits our existing rule
unchanged — *it acts as the logged-in user, never above them* — and our audit log already records
assistant-initiated actions.

⚠️ Our equivalent of "Help & Docs" matters most and is the cheapest: a read-only agent over
`CLAUDE.md`, `docs/` and the hotel's own settings, which **cannot write**, answers most of what a new
hotelier asks in week one.

### ☐ 5. A hosted MCP server

They expose `mcp.1club.ai/admin`. A customer adds it as a connector in **their own** Claude or
ChatGPT, signs in with OAuth (no API token to copy), picks an organization and authorizes. Settings
then shows **Connected assistants** — Assistant · Authorized by · Scopes · Last used — with
revocation. A live row shows Claude holding 28 scopes.

This is the most forward-looking thing in their product and **nobody in hospitality software is doing
it**. A hotelier asking their own assistant "what is my occupancy next week, and what did I lose to
commission" — against scoped, revocable, tenant-isolated access — is a real differentiator.

We are well placed: `@revio/core` already centralises the domain logic, RLS already enforces the
tenant perimeter, and `ACCESS-MODEL.md` already defines the two perimeters. The work is an OAuth
surface and a scope model, not new domain code.

⚠️ Scopes must be **read-only in V1**. An MCP write path is an unauthenticated-input path into
inventory, and that is the one thing `apps/booking/CLAUDE.md` exists to be careful about.

### ☐ 6. Product analytics — PostHog

They run PostHog EU with **session replay**, surveys, dead-click autocapture and web vitals. We have
GA4 on the marketing site and **nothing inside the products**.

The operator console can already detect *stalled onboarding* — it cannot show **why**. Session replay
answers that directly. EU-hosted matters for our GDPR posture; it is the same reason we chose Resend
in the EU. Gate behind the existing consent model and never record card or personal fields.

---

## P2 — smaller, still worth doing

| | Idea | What it becomes here |
| --- | --- | --- |
| ☐ | **Payment Link** template | Chase a deposit or balance with one link. We take a card guarantee but have no way to ask for money later |
| ☐ | **Segment tabs with live counts** | Reservations/Guests get `All 76 · Arriving today 4 · In house 12 · Unpaid 3`, so the shape is readable before clicking |
| ☐ | **Column visibility + filter badges** | Their DataGrid gives "Hide fields" and a filter count free. Ours are hand-rolled; add both to the reservation and guest tables |
| ☐ | **Notifications as a centre** | `Configure · Unread · History` at `/notifications`, not only a bell. Ours has no history and no per-user configuration |
| ☐ | **Per-hotel sending inbox** | Their *Email Inboxes* tab lets a club send from its own address. We send *as the hotel's name* from `reviosoft.app`; this is the per-hotel sending domain already noted in the gap register |
| ☐ | **GTM on the booking engine** | Let each hotel load their own Google Tag Manager container on RevioDirect, so their marketing team measures their own funnel |
| ☐ | **Refund ladder by lead time** | Their cancellation policy is a visual ladder — 100% ≥24h, 50% 8–24h, 0% <8h. Our cancellation policy is a label with no terms (noted in P2 of the welcome-flow work) |
| ☐ | **Auto-tags** | They tag members *Ghost*, *Overdue*, *Probation*. Ours would be *Repeat guest*, *No-show risk*, *Balance owing* — derived, never stored as an opinion |

### Integrations that land on roadmap items we already have

- **Hype POS** — pushes orders to a fiscal POS. That is our pending **F3 Bulgarian fiscalization**,
  solved by integration rather than by building a fiscal device driver.
- **DatecsPay (BORICA)** / **myPOS** — Bulgarian payment rails, our market exactly.
- **WebLock (Valnes)** — door access with a **unique PIN per booking**. `BUILD-PLAN.md` lists
  "lock/key hardware integration" under PMS V2; this is what it looks like shipped.

---

## Rejected, with reasons

- **Branded mobile app.** Gym members re-book weekly; a hotel guest books once a year and will not
  install an app. Our PWA housekeeping board is the right shape for the people who *are* daily users.
- **Their marketplace / directory listing.** A Revio-powered hotel directory competes with our own
  customers' direct-booking pitch. It is the OTA model we position against.
- **Review gating.** See item 2 — same goal, different mechanism, because theirs is against Google's
  policy.
- **Client-rendered SPA + separate Express API.** Simpler than ours, and we would lose RLS-backed
  server actions to get there.

---

## Small details worth stealing outright

Cheap, and they are the difference between "works" and "considered":

- **Honest automation metadata** — they render *"1 step · 0 runs · Never run"* rather than implying a
  rule works. That is our own zero-from-silence rule, arrived at independently. Any automation UI we
  build states its run count and last run.
- **Microcopy that explains fallbacks** — *"Falls back to the page title"*, *"Falls back to the site
  logo"*, *"Keeps the page out of Google and out of your sitemap."*
- **A "Now" marker** on hour-of-day charts.
- **Keyboard-accessible drag and drop** — *"press space to lift, arrows to move"*.
- **⌘K everywhere**, not just on one screen.
