# Testing with a real property — what to send the owner

> Written for the first live test: a villa, real details, real Booking.com ID.
> **Nothing in steps 1–5 costs anything.** The meter starts at step 6, and only there.

---

## What you do first (five minutes, Operator console)

The hotel cannot create its own account — that is a contract step, deliberately.

1. **Operator → Clients → new client.** Name, the owner's email, the property, and tick
   **RevioLink**. (Tick RevioCRS too if you want them to see reservations; it changes nothing about
   the Channex path.)
2. **Check they are not flagged as a demo tenant.** `channex:onboard` and the in-app provisioning
   both refuse a demo tenant, on purpose — a real adapter must never point at demo data. If the
   villa was set up as a demo, promote it to a real client on the client page first.
3. The owner gets an invitation email and sets their own password. Nobody here ever knows it.

**Then send them everything below and nothing else.** From this point it is self-serve.

---

## What to send them

> ### Setting your villa up on Revio
>
> You'll get an email inviting you to Revio. The whole thing takes about half an hour, and
> **nothing goes on sale until you press a button that says so.**
>
> **1 · Set your password.** The link in the email. Let your browser save it.
>
> **2 · Answer the setup questions.** Rooms and how many of each, your prices, your tax details,
> your check-in and check-out times. This is the part that takes the longest and it is the only
> part that needs you to look things up. Have your VAT number to hand.
>
> **3 · Go to Channels and press "Set up channels".** One button, about a minute. It registers
> your rooms and prices with our distribution network. **Nothing is on sale and nothing is charged
> at this point** — it is the plumbing, not the switch.
>
> **4 · Press "Connect channel" and choose Booking.com.** It will ask you for one thing: your
> **Booking.com Hotel ID**. That is the number in your Booking.com extranet, not a Revio number.
>
> **5 · Booking.com will need you to approve us.** In your own Booking.com extranet, you have to
> authorise Revio as your connectivity provider. We cannot do this for you — it is your contract
> with them. When you press Connect, we check whether it has been done, and tell you plainly if it
> has not. This is normally the only part that takes more than a day.
>
> **6 · Activate.** This is the one that matters. Your rooms go on sale on Booking.com the moment
> you press it. Everything before it is reversible and reaches nobody.
>
> If anything is confusing or a screen says something that makes no sense, **screenshot it and send
> it back** — that is more useful to us than you working around it.

---

## What we expect to break

Said honestly so nobody is surprised, and so a failure is reported rather than worked around.

- **Step 4/5 has never run against a real OTA.** The form is generated from Channex's own field
  descriptor and the create/test calls are written and typechecked, but no real Booking.com
  connection has been made through this screen. **This is the step to watch.**
- **Step 3 has run end to end on the sandbox** (42/42 updates accepted, real task id) and the same
  code path now runs from the app. The production account has held 0 properties until now.
- Everything before step 3 is well-trodden.

## What it costs

| Step | Billed by Channex? |
| --- | --- |
| 1 · account, 2 · setup | No |
| 3 · set up channels — property, rooms, rates | **No** |
| pushing rates and availability | **No** |
| 4 · connect a channel | No |
| **6 · activate** | **Yes — this property now counts** |

Channex bills on *properties with at least one active channel*. Everything up to activation is free,
which is why the whole rehearsal can happen on production without a decision.

## If you want a dry run first

`pnpm --filter @revio/connectivity channex:onboard --tenant <slug> --sandbox` does steps 1–3 against
`staging.channex.io`, and `--cleanup` removes it afterwards (it refuses to delete a property that has
channels attached). Useful for us; not something to ask an owner to do.
