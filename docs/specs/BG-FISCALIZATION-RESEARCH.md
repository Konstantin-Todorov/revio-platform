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
