# Invoice numbering

Two systems issue numbered documents, and both are governed by the same Bulgarian rules.

| | Who issues | To whom | Where |
| --- | --- | --- | --- |
| **Operator invoices** | Revio | hotels | Operator → Billing |
| **Tax invoices** | a hotel | its guests | RevioPMS → Folio |

## The rule

**ЗДДС чл. 114, ал. 1, т. 2** and **ППЗДДС чл. 78**: a document must carry

> пореден **десетразряден** номер, съдържащ **само арабски цифри**

— a sequential **ten-digit** number containing **only Arabic numerals**, ascending, **без дублиране и
пропуски** (no duplication, no gaps).

Four consequences, each of which the first implementation got wrong:

1. **No letters and no separators.** `REV-2026-0001` and `INV-2026-0001` are not invoice numbers.
2. **Exactly ten digits**, zero-padded. `296` is written `0000000296`.
3. **No annual reset.** The sequence runs continuously for the life of the taxable person. A year in
   the number, or in the counter's key, produces a duplicate every January.
4. **No gaps.** A number that is claimed and not used is a question an auditor asks and nobody can
   answer. Allocation and the document write must be one transaction.

The rules explicitly permit **several ranges** for one taxable person, "според нуждите на данъчно
задълженото лице". That is what makes everything below legitimate.

## The ranges

| Range | Used by |
| --- | --- |
| `0000000001`–`0999999999` | the books kept by hand — **untouched by the software** |
| `1000000000`+ | Revio's operator invoices (`OperatorCompany.invoiceNumberStart`) |
| `1000000000`+ *(per property)* | each hotel's guest invoices (`PropertyDefaults.invoiceNumberStart`) |
| `DEMO-000001`+ | demo tenants — **deliberately an illegal format** |

Each hotel is its own taxable person with its own books, so each property carries its own start. A
hotel already invoicing on paper sets it clear of what it has issued — the same problem we had, one
level down.

The demo range is a letter prefix on purpose. A second ten-digit range would be tidier and visually
identical to a real invoice; being obviously invalid is the point.

## What shares a range

**Invoices and credit notes share one range** per issuer. An известие is a данъчен документ exactly
as a фактура is, and "без дублиране" applies across all of a taxable person's documents — two
independent counters could hand the same number to both on the same day.

**A proforma does not.** It is not a tax document, carries no VAT consequence, and keeps
`PRO-2026-0001`. It must neither consume a legal number nor look like one.

## Not hardcoded to Bulgaria

`PropertyDefaults.invoiceNumberScheme` is `bg_10digit` (default) or `prefixed`. The numbering format
is the most country-specific thing on an invoice; baking Bulgaria's in would make every foreign hotel
non-compliant instead of only the Bulgarian ones. The logic is pure and tested in
`packages/core/src/invoicing/numbering.ts`.

## Changing a start number

**Only before the first document is issued.** Afterwards it either repeats a number or opens a gap.
The operator form locks the field once the counter exists; do the same for any new surface.

## Not covered here

Real-time fiscal reporting (**Наредба Н-18**) is a separate obligation and is **not implemented** —
`TaxInvoice.fiscalRef` and the jurisdiction pack exist, the integration does not. Correct numbering
is necessary and not sufficient. See `docs/specs/BG-FISCALIZATION-RESEARCH.md` and `GO-LIVE.md` §5.

## Confirm with an accountant

The reading above is ours. It should be checked against the company's actual registrations before the
first document goes out — particularly the shared invoice/credit-note range, where a separate range
per document type is also defensible.
