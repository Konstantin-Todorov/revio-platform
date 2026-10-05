# Fiscal printer — print the receipt on the hotel's own device

> 2026-10-05. Founder: „почвай фискалния принтер“. Legal basis and the correction that made this
> possible: `BG-FISCALIZATION-RESEARCH.md` §Second correction. Not tax advice.

## The one-paragraph design

A cash or card payment taken at the desk needs a fiscal receipt (Н-18 чл. 3 ал. 1 — the rule is
already `fiscalRequirement` in `@revio/core`). The hotel's registered device (Datecs, Daisy, Tremol,
Eltrade…) sits next to the front-desk PC. The hotel installs **ErpNet.FP** — free, open-source (ISC),
a Windows service — on that PC. When the receptionist records the payment, **the PMS page in the
browser** sends the receipt to `http://localhost:8001`, gets back the device's receipt number, and
stores it on the payment line. No server of ours talks to the device, no hardware of ours sits in the
hotel, nothing is installed but ErpNet.FP.

## Why the browser and not our server

The printer is on the hotel's LAN; our servers are on the internet. The receptionist's browser is the
only thing that is on both. ErpNet.FP supports this directly: `WebAccess.AllowedOrigins =
["https://pms.reviosoft.app"]` and `EnablePrivateNetwork = true`. Chrome asks once to allow access to
local devices.

## What is printed

`buildFiscalReceipt` (core, pure) turns one payment into a receipt:

- **Items** — the folio's charges grouped by **tax group**, scaled pro-rata to the payment, so a
  deposit of €50 on a €200 stay prints €50 split the way the stay is split. Integer cents, largest
  remainder, sums exactly to the payment.
- **Tax groups** (Н-18 letters, ErpNet.FP numbers 1–8): defaults standard 20% → **Б (2)**, reduced 9% →
  **Г (4)**, tourist tax and exempt → **А (1)**; a property that is not VAT-registered prints
  everything in **А**. Editable per property — the accountant has the last word.
- **Payment** — `cash` or `card`. Methods that need no receipt (bank transfer, company account, OTA
  prepayment) never reach the printer.
- **Idempotent**: the task id is the payment line id, so a double click or a lost response can never
  print twice — we ask ErpNet.FP for that task's result instead.

## What the receptionist sees

The payment row says one of three things, and only the middle one asks for anything:
**„Бон № 0000085“** · **„Бонът не е отпечатан — Отпечатай отново / Въведи номера ръчно“** ·
**„Не се изисква бон — банков превод“**. Manual entry stays, for a hotel without ErpNet.FP or a day the
printer is out of paper — the device is still the system of record either way.

## Phases

1. **Core + data** — `buildFiscalReceipt` with tests; `FolioLine.fiscalReceiptNo/At/DeviceSerial`;
   `PropertyDefaults.fiscalDevice` (`none` | `erpnet`) and `fiscalTaxGroups`.
2. **Configuration** — a „Фискално устройство“ section; per-computer printer choice (stored in that
   browser, because each desk has its own device) with „Провери връзката“.
3. **Folio** — print on payment, status on the row, reprint, manual entry.
4. **Refunds and the day** — reversal receipt (сторно) on a refund; Z-report from Close Day.
5. **Hotel guide** — a one-page Bulgarian install guide for ErpNet.FP; a fake printer for demos.
