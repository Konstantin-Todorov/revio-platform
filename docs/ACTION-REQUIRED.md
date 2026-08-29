# Waiting on you

Everything the platform cannot decide for itself. Nothing here is a code task — each item needs a
person: a credential, a legal confirmation, a dashboard setting, or a judgement about the business.

Ordered by what goes wrong if it is missed. Last reviewed **2026-08-24**.

---

## 🔴 Blocks the first paying client

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
| **`book.revio.app` DNS** | on `booking.reviosoft.app` | The only page a *guest* sees; it should not sit on a vendor-shaped URL. DNS + `BOOKING_ENGINE_ORIGIN`. |
| **Per-hotel sending domains** | guest email goes out as Revio | A hotel's confirmation should carry the hotel's brand, not its vendor's. |
| **Server-rendered PDFs** | HTML download + browser print | Only needed when an invoice must be *attached* to an email. Headless Chromium on a platform already taken down once by a compute limit. |
| **Support and incident basics** | undefined | Who a hotel calls at 23:00 when check-in fails. |

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
