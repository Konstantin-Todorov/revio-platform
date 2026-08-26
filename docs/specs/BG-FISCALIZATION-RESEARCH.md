# Bulgaria fiscalization — what is actually required

> **Rewritten 2026-08-26 after reading Наредба Н-18 itself.** The previous version of this document
> was wrong in a way that mattered, and the correction is recorded below rather than quietly edited
> out. Not tax advice — the hotel's accountant confirms, per property.

## The correction

The 2026-07-26 pass stated that Bulgaria requires every consumer sale — **"cash, card, bank
transfer"** — to be reported to НАП in real time, and concluded that fiscalization was an absolute
launch blocker for any Bulgarian property.

**Bank transfer is explicitly exempt.** Наредба Н-18, чл. 3, ал. 1:

> „...освен когато плащането се извършва чрез внасяне на пари в наличност по платежна сметка,
> **кредитен превод**, директен дебит или наличен паричен превод“

— *except where payment is made by paying cash into a payment account, **credit transfer**, direct
debit, or cash postal transfer.*

Two further corrections followed from re-reading rather than remembering:

- **СУПТО is voluntary**, not mandatory. The obligation was removed when чл. 118 ЗДДС was amended.
  Software that manages sales is not thereby forced onto the НАП register.
- **The April 2026 Приложение 29 measure binds producers *of СУПТО*.** It requires a producer or
  distributor of software *that is СУПТО* to declare its conformity. It does not sweep in software
  that is not.

## The rule, in one line

**Fiscalization is triggered by the payment method — not by the sale, the invoice, or the software.**

| How the money arrives | Fiscal receipt? | Why |
| --- | --- | --- |
| Cash at the property | **Required** | чл. 3 ал. 1 |
| Card at the property | **Required** | A card is not a credit transfer — not in the exemption list |
| Bank transfer | Exempt | кредитен превод |
| Company account, settled by transfer | Exempt | кредитен превод |
| OTA prepayment | Exempt | The guest paid the OTA; the OTA remits by transfer |

Encoded and tested in [`packages/core/src/fiscal/receipt-requirement.ts`](../../packages/core/src/fiscal/receipt-requirement.ts).
An unresearched jurisdiction returns `null`, never "exempt".

**Consequence:** a hotel selling through OTAs, invoicing companies and taking bank transfers needs
**no fiscal device at all** and can go live on Revio today. A hotel whose front desk takes cash or
cards needs one — and almost certainly already has one, because they have been trading legally.

## Revio does not fiscalize, deliberately and permanently

СУПТО being voluntary means we have a choice. We are declining it, and the reason is not effort:

> Software that drives a hotel's fiscal device **becomes СУПТО**, and the obligations then land on
> **the hotel**. They must use that one software *exclusively* for sales at that site; every fiscal
> device there is demoted to a printer driven by us; and they must declare us to НАП within 7 days of
> installation, including where our database lives.

That turns "add a channel manager" into "replace your entire till", and makes Revio unsellable
alongside the POS a hotel's restaurant, bar or spa already runs. It is the opposite of the composable
model the whole platform is built on.

**So: the hotel's existing certified device stays the system of record for receipts.** Revio *records*
the receipt number that device produced and reconciles against it. We report the requirement; we never
satisfy it. This keeps us off the register, keeps the hotel's other systems intact, and unblocks sales
now.

The escape hatch, if a customer ever demands full СУПТО: integrate a provider that is *already* on the
register and let **their** certification carry it, via `fiscal.ts`'s `provider` mode. That mode is
declared and still unimplemented — correctly, since nothing needs it yet.

## What is built

- **`packages/core/src/fiscal/receipt-requirement.ts`** — the чл. 3 ал. 1 rule, pure, 12 tests.
  `fiscalRequirement(jurisdiction, method)` and `needsFiscalDevice(jurisdiction, accepted[])`.
- **`apps/pms/lib/fiscal.ts`** — `recordFiscalReceipt` (the real path) and `fiscalStatusNote` (what
  the screen says). `fiscalizeInvoice` now returns `null` for a real tenant.
- **`PropertyDefaults.jurisdiction` / `fiscalizationEnabled`** — the per-property pack (E7).
- **`TaxInvoice.fiscalRef`** — holds the device's number, not one we invented.

### The bug this fixed

`fiscalizeInvoice` used to mint `NRA-3F8A21C4` from a hash and stamp it on a real tax invoice whenever
a property ticked a checkbox. A fabricated fiscal reference on a legal document is not a placeholder —
it is a document that misstates its own compliance, and it would have been *our* code that put it
there. The mock now refuses to run for a non-demo tenant, and a demo seal is prefixed `DEMO-` so it
cannot be mistaken for real in a screenshot or in the database.

## Revio's own invoicing (us → hotels)

**Nothing is required.** Hotels pay us by bank transfer, which is exempt under the same article. Our
operator invoicing is legally complete as built: 10-digit ascending numbering per ЗДДС чл. 114 and
ППЗДДС чл. 78, 20% VAT, reverse charge for EU B2B. No fiscal device, no СУПТО, no declaration.

If we ever take card payments from hotels, this changes — and it is one more reason not to.

## Non-blockers (design for, don't build)

- **SAF-T** — phased from Jan 2026, large enterprises first. Keep the model exportable.
- **B2B e-invoicing / ViDA** — EN 16931; cross-border mandate 1 July 2030. Voluntary in BG today.
- **EUR** — adopted Jan 2026. The folio currency is already correct.

## Sources

- [Наредба Н-18, full text (kik-info)](https://kik-info.com/normativna-baza/naredbi/h-18/) — чл. 3 ал. 1
- [НАП — Информация за потребители на СУПТО](https://nra.bg/wps/portal/nra/fiskalni-ustroystva-supto-i-e-magazini/supto/page.Informacia-za-potrebiteli-na-SUPTO)
- [НАП — Деклариране на СУПТО от производители/разпространители](https://nra.bg/wps/portal/nra/fiskalni-ustroystva-supto-i-e-magazini/supto/page.deklarirane-supto)
- [Новата Наредба Н-18 предвижда изричен отказ от СУПТО (Economix)](https://economix.bg/%D0%BD%D0%BE%D0%B2%D0%B0%D1%82%D0%B0-%D0%BD%D0%B0%D1%80%D0%B5%D0%B4%D0%B1%D0%B0-%D0%BD-18)
- [МФ официално становище за СУПТО, 19.11.2025](https://www.minfin.bg/bg/news/13197)
- [Анализ на Бюджет 2026 в частта СУПТО](https://aparati.bg/supto-v-budget-2026-i-eu-regulacii/)
