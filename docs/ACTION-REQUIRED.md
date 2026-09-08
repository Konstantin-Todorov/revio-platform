# Waiting on you

Everything the platform cannot decide for itself. Nothing here is a code task — each item needs a
person: a credential, a legal confirmation, a dashboard setting, or a judgement about the business.

Ordered by what goes wrong if it is missed. Last reviewed **2026-08-24**.

---

## 🔴 Blocks the first paying client

### 0. ~~A WORKING Channex API key~~ — ⚠️ THIS ENTRY WAS WRONG (corrected 2026-09-01)

It said both Channex keys were dead. **They were not.** The platform key authenticates fine —
`GET https://app.channex.io/api/v1/properties` → **HTTP 200**, three properties visible.

Every "401" behind that claim came from my own key-health checker, which had hardcoded
`secure.channex.io` — **not a Channex host**. Kept rather than deleted because it was acted on.

**What is actually true:**
- The platform key works. `Chervena Vila` provisioned, pushed (17×) and pulled (15×) with no errors.
- **`Ethno Villa Cherry` points at a property id that does not exist in Channex** (`d633e271…`),
  while **two** properties named "Ethno Villa Cherry" DO exist (`3987f78c…`, `7eb14a83…`). Provisioning
  evidently ran more than once. That is the real remaining fault, and it needs a person to decide
  which duplicate to keep and which to delete in Channex.

Full explanation of how any of this fits together: **`docs/CHANNEX-CONNECTION.md`**.



### 1. ~~Store the Channex production API key~~ ✅ DONE
**Status (verified 2026-08-29):** `CHANNEX_PROD_KEY` is set on `channel-manager`, `reservation` and
`pms`, and authenticates — a live `GET /properties` returned **HTTP 200** with 0 properties.

⚠️ An **unauthenticated** Channex request returns 401 with no `data` key. A script that reads
`len(data)` will report "0 properties" either way. Check the status code, not the array.

The per-tenant encrypted path (**Operator → Connectivity**, `ConnectivityCredential`, `operator_only`
RLS) is still preferred over the env fallback and is what a hotel bringing its own Channex account
will use. Nothing is blocked on it today.

### 2. Confirm the VAT treatment with an accountant
Three readings are ours and should be checked against your actual registrations **before the first
invoice is sent**. All three are implemented and all three are reversible now and expensive later.

| Reading | Where | If it is wrong |
| --- | --- | --- |
| **List prices EXCLUDE VAT** — €49 becomes €58.80 | `apps/operator/lib/vat.ts` | every invoice is 20% out |
| **EU business with a VAT number → reverse charge, 0%** | `decideVat` | you bill 20% they cannot reclaim, or owe VAT you never collected |
| **Invoices and credit notes share one number range** | `docs/INVOICE-NUMBERING.md` | a separate range per document type is also defensible |

`pricing.ts` never stated a VAT position, so the net reading was chosen and written down rather than
assumed silently. Confirmed at 20% domestic on 2026-08-24; the rest still needs a professional eye.

#### ⚠️ These are OUR invoices to a hotel. The hotel's invoices to its guests are a different question.

Worth separating, because conflating them is how a hotel ends up charging its guests the wrong rate:

| | Rate | Where it lives |
| --- | --- | --- |
| **Revio → hotel** (the SaaS subscription) | **20%** standard | `apps/operator/lib/vat.ts` — the three readings above |
| **Hotel → guest** (the room) | **9%** reduced — accommodation | `PropertyDefaults.vatReducedPct`, asked in first-run setup |
| **Hotel → guest** (minibar, restaurant, extras) | **20%** standard | `PropertyDefaults.vatStandardPct` |

The platform already models this correctly — first-run setup asks for both rates separately with
Bulgarian defaults, `apps/pms/lib/invoice.ts` falls back to `{ standard: 20, reduced: 9 }`, and the
seed carries `VAT 9%` on accommodation. **Checked on 2026-09-08, nothing to change.**

#### Still open, and worth an accountant's half hour

1. **The registration threshold moved on 2026-01-01** — EUR 51,130 of taxable turnover, on a
   **calendar year** rather than the rolling twelve months it used to be. If Revio is not yet
   VAT-registered we must not be charging 20% on anything; if turnover crosses that line mid-year,
   registration is not optional. `Company.standardVatPct` defaults to 20 with no registration check
   behind it.
2. **Breakfast included in a room rate.** 9% or 20%? A bundled supply is a classic split-rate trap
   and the answer decides how `computeStayCharges` should tag the line.
3. **City tax (туристически данък)** is a municipal tax, not VAT. We model it as a fixed fee outside
   the VAT base — confirm that is right, because if it is inside the base every folio is a little
   wrong.
4. **The euro changeover.** The threshold above is already quoted in euro. Invoices spanning the
   transition, and whether dual display is required, is a compliance question we have not answered.
5. **Fiscalization** is adjacent and separate — a Bulgarian hotel taking cash has НАП device
   obligations. See `docs/specs/BG-FISCALIZATION-RESEARCH.md`; `TaxInvoice.fiscalRef` is the seam.

### 3. Billing details for each real client
A client cannot be invoiced without their **legal** entity name, country and address — the trading
name is not who owes the money, and the country decides the VAT treatment. Client page → Billing
details. The three demo tenants are already filled in so the flow can be rehearsed.

### 4. Fiscalization — ⚠️ THIS ITEM WAS WRONG, and is no longer a blocker

It said a Bulgarian property cannot issue guest invoices without real-time fiscal reporting, and
called it the longest-lead item on the list. **Reading Наредба Н-18 itself on 2026-08-26 contradicted
that**, and the correction is recorded rather than deleted because the wrong version was believed for
a month.

**чл. 3 ал. 1 exempts bank transfer** (`кредитен превод`), direct debit and cash paid into a payment
account. Only **cash and card taken at the property** require a fiscal receipt — and any hotel taking
those already has a registered device, because they have been trading legally. A property selling
through OTAs, invoicing companies and taking transfers needs **no fiscal device at all**.

**We do not fiscalize, deliberately and permanently.** СУПТО is voluntary since чл. 118 ЗДДС was
amended, and driving a hotel's fiscal device would make our software СУПТО — landing the obligations
on the *hotel*: exclusive use for all sales at that site, every fiscal device demoted to our printer,
and a declaration to НАП naming where our database lives.

**Nothing here blocks a launch.** Full reasoning and sources: `docs/specs/BG-FISCALIZATION-RESEARCH.md`.

---

## 🟠 Needed at the moment a client is onboarded

### 5. That hotel's Channex property
Either create it in the portal and give me the UUID, or tell me to create it via the API. Then I map
room types and rate plans both ways and switch the channel `channex_sandbox` → `channex_prod`.

**Nothing should be created before there is a real hotel.** All three tenants are demo, and the rule
in `factory.ts` is that a real adapter is never pointed at demo data. Channex bills per property with
an active channel — currently 0.

### 6. That hotel's own OTA credentials
Booking.com, Expedia, and so on. They belong to the hotel, not to us. Channex needs them to connect
each channel.

### 7. Their invoice number range
Each property is its own taxable person with its own books. A hotel already invoicing on paper must
set its software range clear of what it has issued — the same problem we had, one level down.
**Settable only until their first document is issued**, then locked, because moving it afterwards
either repeats a number or opens a gap.

---

## 🟡 Should be done before you depend on it

### 8. A Railway usage alert below the hard cap
The 2026-08-23 outage was a **ceiling, not a crash**: a $15 compute cap stopped all six services and
the Postgres container. Uptime monitoring now catches that within ten minutes — but a warning
*before* the cap executes beats an alert afterwards. Railway dashboard; also consider whether Hobby
is still the right plan.

### 9. Staging environment — a decision, not just a task
`git push` deploys straight to six production services with no rehearsal. A second Railway
environment is the single change that most reduces the chance of a customer seeing a bad deploy.

### 10. Branch protection on `main`
CI is green but nothing enforces it — a red CI still deploys. **This changes your workflow**: with
required checks, direct pushes are rejected and everything goes through a PR. Worth it before real
clients; decide deliberately rather than drifting into it.

### 11. Email — finish the authentication chain
- **cPanel DKIM** for the SuperHosting mailboxes: `default._domainkey.reviosoft.app` is empty, so
  human mail from `office@` is unsigned.
- **DMARC is `p=none`** — move to `p=quarantine` *after* the above, never before.
- Confirm a real contact-form submission lands in `office@` (never actually verified).

---

## 🔵 Open decisions, no deadline

| Decision | Current state | Note |
| --- | --- | --- |
| **Guest card payments** | mocked; Stripe locked to `sk_test_` | Deferred 2026-08-24: hotels pay by bank transfer. Going live needs Stripe Elements and Connect onboarding per hotel. |
| ~~`book.revio.app` DNS~~ | ☑ live on `booking.reviosoft.app` | **Dropped 2026-09-07** — `revio.app` is not ours (it resolves to a third party) and `book.revio.app` is NXDOMAIN. The brand domain is **reviosoft.app**; the booking engine is live and correct at `booking.reviosoft.app/<slug>` and `BOOKING_ENGINE_ORIGIN` already points there. There was never anything to do. |
| **Per-hotel sending domains** | guest email goes out as Revio | A hotel's confirmation should carry the hotel's brand, not its vendor's. |
| **Server-rendered PDFs** | HTML download + browser print | Only needed when an invoice must be *attached* to an email. Headless Chromium on a platform already taken down once by a compute limit. |
| ~~Support and incident basics~~ | ☑ **built 2026-09-08** | "Get help" in every product's account menu → a recorded `SupportRequest` + an email to the support inbox; an operator queue at `/support` sorted by how late against the promise. ⚠️ **The promise is `SUPPORT_KINDS` in `@revio/core` — 2h urgent / 1 working day / 2 working days, 08:00–22:00 EET. Change it there if the answer changes: the same constants are shown to the hotel and used to decide what is overdue.** There is deliberately no 24/7 claim. |

---

## ✅ Closed — do not redo

- Channex **PMS certification passed**; production organisation live, plan Standard.
- **Invoice numbering** corrected on both sides before a single number was issued
  (`docs/INVOICE-NUMBERING.md`).
- **Monitoring**: health endpoints, external uptime checks, a cron dead-man's switch, and unhandled
  errors captured — alarm tested by deliberately breaking a probe.
- **Company identity + operator invoicing** built; your details are in.
- **N4/N5**: TOTP 2FA, password policy with breach checking, auth audit trail, key rotation for both
  secrets without signing anyone out.
- **The jobs scheduler** is live, 6/6 green.
