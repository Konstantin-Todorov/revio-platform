# Bulgaria fiscalization & e-invoicing — research pass (F3)

> Scope: what a Bulgarian property legally needs before go-live, and how Revio's **fiscalization
> boundary** (`apps/pms/lib/fiscal.ts`, spec §4.7) plugs into a certified provider. **Verify every
> date/threshold at build time — these move.** Nothing here is built in-house; the PMS routes through
> a certified provider, gated by the property's jurisdiction pack (Configuration → Compliance pack).

## The two obligations (they are NOT the same)

1. **Fiscalization — the launch blocker.** Under **Ordinance N-18** (Наредба Н-18), a VAT-registered
   business must transmit every consumer sale (cash, card, bank transfer) to the **National Revenue
   Agency (NRA / НАП)** in **real time**, through either:
   - a **certified fiscal device (ФУ/ЕКАФП)** — a registered cash register with a fiscal memory, or
   - **SUPTO-certified software (СУПТО)** — commercial sales-management software on the NRA's approved
     register, which stamps each receipt with a **unique sale number (УНП)** and reports it.
   A Bulgarian property **cannot go live** without sales flowing through one of these. Treat as a
   **hard launch blocker**, integrated via the boundary — never reimplemented.

2. **Structured e-invoicing / digital reporting — design-for, not a blocker (yet).** B2B e-invoicing
   in Bulgaria is currently **voluntary** (public bodies must be able to *receive* EN-16931 invoices).
   **SAF-T** monthly reporting began **January 2026** (large enterprises first, phased toward almost
   all taxpayers by ~2030) — an accounting export, so keep the data model **SAF-T-exportable**. EU-wide
   **ViDA** mandates cross-border B2B e-invoicing/digital reporting from **1 July 2030** on EN 16931.

Note: Bulgaria adopted the **euro (Jan 2026)**, so **EUR as the folio currency is already correct.**

## Provider landscape (integrate via the boundary — do not certify our own device)

The pragmatic path is a certified provider that exposes an API; Revio calls it and stores the returned
УНП / fiscal seal on the receipt/invoice. Categories to evaluate at integration time:

- **SUPTO-certified cloud POS / fiscalization APIs** — software on the NRA approved register that
  handles the real-time report and returns the sale number. Preferred for a cloud PMS (no hardware).
- **Fiscal-device gateways** — services that drive a registered ФУ/fiscal printer and return the seal
  (useful where a property already runs certified hardware).
- **Pan-EU e-invoicing / Peppol access points** — for the EN-16931 / ViDA side when B2B e-invoicing
  turns on (design-for now).

Selection criteria: on the current **NRA SUPTO register**, documented **REST API** (report sale →
receive УНП; void/refund; daily Z-report), sandbox/test env, EUR-ready, and support for both receipts
(fiscalization) and structured invoices (e-invoicing) so one integration covers §4.7's two obligations.
**Action before a real BG go-live:** confirm the shortlisted provider is currently NRA-registered and
its API contract, then implement `fiscal.ts`'s `provider` mode against it.

## How it wires into Revio (already built, mock-first)

- **Config (E7):** `PropertyDefaults.jurisdiction` (`bg`), `fiscalizationEnabled`, `eInvoicingEnabled`
  — the per-property jurisdiction pack, edited in **Configuration → Compliance pack**.
- **Seam (F3):** `lib/fiscal.ts` `fiscalizeInvoice(cfg, doc)` — no-op when disabled; when enabled it
  returns a fiscal reference (mock seal today; **swap this one call for the certified provider's API**
  in a real deployment — nothing else changes).
- **Invoice (E6):** on issue, `generateInvoice` calls the boundary and stamps `TaxInvoice.fiscalRef`
  on the document; the printable invoice shows the reference (or the "not yet fiscalized" note when off).
- **Payments (F2):** the payment gateway is a **separate** boundary; fiscalization reports the *sale*,
  the gateway *captures the card* — both real-time, both provider-routed, kept independent.

**Developer rule:** fiscalization/e-invoicing is a boundary like the payment gateway — route through a
certified provider, gate by jurisdiction pack, keep the invoice/receipt core generic. Building the seam
now is cheap; retrofitting a real-time fiscal-device requirement into a direct-print flow later is not.

---

## Go-live gate — verified status (2026-07-26)

Re-checked against the code, not against memory. **Fiscalization is a hard blocker for a Bulgarian
property and it is NOT satisfied today.**

**What exists:** the *boundary*, and only the boundary. `apps/pms/lib/fiscal.ts` mints a deterministic
pseudo-seal and returns `mode: "mock"`. The `"provider"` mode is declared in the `FiscalResult` type
but **never returned by any code path** — there is no provider API call anywhere in the repo. The
invoice module stores the returned reference on `TaxInvoice.fiscalRef`, and `PropertyDefaults`
carries the `bg` jurisdiction flags. So the wiring is real and the seal is not.

**What that means commercially:** a VAT-registered Bulgarian hotel may not legally take a consumer
sale unless it flows through a certified fiscal device (ФУ/ЕКАФП) or NRA-registered SUPTO software in
real time. Revio currently produces an invoice with a **fake** fiscal reference. Shipping that to a
real BG property would put *the hotel* in breach — this is their licence, not just our feature gap.

**Therefore:** either (a) integrate a certified provider before the first Bulgarian client goes live,
or (b) land the first client under an arrangement where their existing certified device/software
remains the system of record for receipts, and Revio does not claim to fiscalize.

**Cannot be retrofitted quietly.** Receipts already issued without a УНП are not made compliant by a
later integration, so the decision must precede the first real sale — not follow it.

### What the founder must procure (not a coding task)

1. **Choose a certified provider** currently on the NRA SUPTO register with a documented REST API
   (report sale → receive УНП, void/refund, daily Z-report) and a sandbox.
2. **Contract + register** — SUPTO usage is registered with the NRA by the *hotel*; confirm who files
   what, and whether our software must itself appear on the register for this model.
3. **Obtain sandbox credentials** so `fiscal.ts`'s `provider` mode can be implemented and tested
   against something real.

Only step 3 unblocks engineering; steps 1–2 are commercial/legal lead time and should start now if a
Bulgarian launch is intended. **Accountant/legal confirmation is required — this summary is research,
not tax advice.**

### Non-blockers (design-for, don't build yet)

- **SAF-T** — phased from Jan 2026, large enterprises first. Keep the data model exportable.
- **B2B e-invoicing / ViDA** — EN 16931, cross-border mandate from 1 July 2030. Voluntary in BG today.
- **EUR** — Bulgaria adopted the euro Jan 2026; the folio currency is already correct.
