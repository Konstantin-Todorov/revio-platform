# Onboarding a hotel

The whole process, in order, with the part that is automated marked as such.

---

## First: whose Channex account?

**Ours. The hotel never sees Channex, and never signs up for it.**

We are a **certified Channex PMS partner**. That certification is exactly what lets us create and
manage properties inside our own Channex organisation on a hotel's behalf, through the API. One
account, one API key, one property per hotel.

| | |
| --- | --- |
| **Channex account** | ours — `konstantin.todoroff PMS` |
| **A hotel** | a *property* inside it |
| **Channex bills** | us, per property **with at least one active channel** |
| **The hotel pays** | us, one subscription — Channex is a cost inside it, not a line on their bill |
| **The hotel's own logins** | their **OTA** accounts (Booking.com, Expedia). Not a Channex account. |

That last row is the one that gets confused. Connecting Booking.com needs the hotel's *Booking.com*
credentials — their hotel ID and the connection they authorise from the Booking.com extranet. That is
unavoidable and normal: it is their inventory and their contract with the OTA. It is not a Channex
signup.

### The exception, and why the code has two paths

A hotel may arrive already running **their own channel manager** — Channex under their own account, or
a third party. The CRS guide (§6.7) allows for this: *"RevioCRS connects through exactly one channel
manager: RevioLink, or a partner's existing third-party CM."*

That is why `channexKey()` looks in two places, in order:

1. **`ConnectivityCredential`** — a per-tenant encrypted key. Used when a hotel brings their own.
2. **`CHANNEX_PROD_KEY`** — our account's key, on `channel-manager`, `reservation` and `pms`.

**The default is the fallback.** Most hotels will never have a row in that table, and that is correct.

---

## The process

### 1 · Create the client — Operator console
Clients → new client: name, owner's email, first property, which products they bought. The owner gets
an invitation and sets their own password; nobody here ever knows it.

### 2 · The hotel sets itself up — their own first-run flow
Rooms, room counts, rate plans, prices, tax details. This has to happen before step 3, because step 3
builds the Channex property **from this data**. Onboarding an empty property creates an empty
Channex property.

### 3 · Create and map the Channex property — one command

```bash
pnpm --filter @revio/connectivity channex:onboard --tenant <slug> --property "<name>" --dry-run
pnpm --filter @revio/connectivity channex:onboard --tenant <slug> --property "<name>"
```

It stores the key encrypted, creates the Channex property, creates a room type per room type and a
rate plan per **(room type × plan)** pair, writes the channel in `channex_prod` with every mapping,
and prints every id.

**Always `--dry-run` first.** It prints the whole plan and touches nothing. This creates objects in a
billed account.

A rate plan per *pair* is not a detail: Channex ties a rate plan to one room type, while we model
plans at property level. A hotel with 3 room types and one "Standard Rate" needs **three** Channex
rate plans, and getting that wrong prices two of the three room types wrong on every OTA — silently.

### 4 · Connect the hotel's OTAs — Channex dashboard, by hand
Each channel needs that hotel's own credentials and, usually, an authorisation from the OTA's own
extranet. This is the step that cannot be automated, and the step that starts Channex billing —
a property only costs money once it has **an active channel**.

Then map the OTA's rooms and rates to ours on Channex's mapping screen.

### 5 · Verify — from the product, not from a script
Re-sync from RevioLink and confirm the Sync Center shows a success with a task id. A push that
succeeds from a script proves the script; a push driven from the UI proves the hotel can do it.

### 6 · Billing starts by itself
Nothing to switch on. The first booking that syncs sets `billingStartsAt` and invoicing begins from
that month — the "free until your first booking syncs" promise, in code. A hotel with no channel
manager becomes billable when it finishes setup instead.

---

## Rehearsing it — do this before the first real hotel

```bash
cd packages/connectivity && set -a && . ./.env.local && set +a
DATABASE_URL="…" CONNECTIVITY_SECRET="…" \
  npx tsx scripts/channex-onboard.ts --tenant hotel-sofia --property "Hotel Sofia — Plovdiv" --sandbox --i-know
```

`--sandbox` runs the whole thing against **staging.channex.io**: real API, real objects, no billing,
no production account touched. `--i-know` is required because the tenant is a demo one, and pointing
a real adapter at demo data is otherwise refused.

Undo it with `--cleanup --sandbox`. It refuses to delete a property that has channels attached, so it
cannot take a live hotel off sale.

**Verified end to end on 2026-08-26** against Hotel Sofia — Plovdiv (3 room types, 1 rate plan — the
shape that exposed the mapping bug):

```
ok  created the Channex property        62deb158-…
ok  room type "Deluxe Room"      6 rooms
ok    rate plan "Standard Rate"
ok  room type "Family Room"      3 rooms
ok    rate plan "Standard Rate"
ok  room type "Standard Double" 10 rooms
ok    rate plan "Standard Rate"
ok  wrote the channel + every mapping — 3 rooms, 3 rates

push: ok=true pushed=42 rejected=0
event: success — Pushed 42/42 updates · 14 days
```

Three room types produced **three separate Channex rate plans**, and the platform's own push landed
42 of 42 with a Channex task id. Then removed; the production account still holds 0 properties.

### ⚠️ The mode picks the host

`createChannelAdapter` derives the base URL from the channel's `connectivityMode`. A sandbox key on a
`channex_prod` channel authenticates against the production host and **every update is rejected** —
42 of 42, on the first attempt at this rehearsal. `--sandbox` now sets the key, the host and the mode
together so they cannot disagree.
