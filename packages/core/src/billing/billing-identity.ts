/**
 * The customer's own company details — what goes on the invoice we issue them.
 *
 * ## Why a hotel fills this in itself
 *
 * It was always required: `issueInvoice` refuses without it and `decideVat` **blocks rather than
 * guesses** when the buyer's country is missing, because defaulting to domestic would quietly
 * overcharge every foreign customer whose address we had not got round to typing. What was wrong is
 * *who* it was required of — us. Every legal name, EIK and VAT number was typed into the operator
 * console by hand, from whatever a hotel had said on the phone.
 *
 * That is worse in three ways at once. It is our time. It is second-hand, so it is wrong more often
 * than the version the hotel's own bookkeeper would type. And it is a **human step in the middle of
 * an automatic flow**: a self-serve trial that converts to a paying account cannot be invoiced at
 * all until somebody notices and fills in a form.
 *
 * ## ⚠️ This is NOT `Property.invoiceIssuerName`
 *
 * That field, asked during first-run setup, is the hotel's identity for the invoices **the hotel
 * issues to its guests**. This is the hotel's identity as **our customer**. Opposite directions, and
 * they must stay apart: a chain may pay us from a head-office entity while each property invoices
 * guests under its own name, and merging them would put the wrong company on somebody's tax
 * document. They look identical on screen, which is exactly why it is written down here.
 *
 * ## What is required, and why each one
 *
 * A refusal here costs a hotel thirty seconds. A missing field costs a defective tax document, which
 * costs a credit note and a conversation with an accountant.
 */

export interface BillingIdentity {
  legalName: string;
  /** ISO 3166-1 alpha-2. THE field that decides the tax treatment. */
  country: string;
  /** National company registration number — EIK in Bulgaria, company number elsewhere. */
  companyId: string;
  /** VAT number. Genuinely optional: plenty of small hotels are not VAT registered. */
  vatId: string;
  addressLine: string;
  city: string;
  postCode: string;
  /** Where the invoice is emailed. Falls back to the account owner when blank. */
  billingEmail: string;
  /** "Accounts payable", a finance manager's name. Optional, and it saves a forwarded email. */
  attention: string;
}

export type BillingIdentityField = keyof BillingIdentity;

/**
 * What is wrong, as a stable name a screen can say in the reader's language. The English `message`
 * stays for every existing caller; a translated screen says `strings[code] ?? message`, and never
 * matches the English sentence (`packages/ui/CLAUDE.md`).
 */
export type BillingIdentityProblemCode =
  | "legalNameRequired" | "countryRequired" | "addressRequired" | "cityRequired"
  | "countryShape" | "vatShape" | "emailShape";

export interface BillingIdentityProblem {
  field: BillingIdentityField;
  code: BillingIdentityProblemCode;
  /** Said to the hotel, in their words, with the reason. Never "invalid input". */
  message: string;
}

/** The fields without which an invoice cannot legally be issued. */
const REQUIRED: { field: BillingIdentityField; code: BillingIdentityProblemCode; message: string }[] = [
  {
    field: "legalName",
    code: "legalNameRequired",
    message: "We need the company's registered name, exactly as it appears on your company documents — not the hotel's trading name, if they differ.",
  },
  {
    field: "country",
    code: "countryRequired",
    message: "The country decides whether VAT applies to your invoice at all, so we cannot issue one without it.",
  },
  {
    field: "addressLine",
    code: "addressRequired",
    message: "A tax invoice must carry the customer's address.",
  },
  { field: "city", code: "cityRequired", message: "A tax invoice must carry the customer's city." },
];

/**
 * EU VAT number shapes, by country.
 *
 * ⚠️ **A format check, never a registration check.** A well-formed number can belong to nobody, and
 * only VIES can say otherwise. This catches the ordinary mistakes — a missing country prefix, a
 * digit too few, a space in the middle — and says nothing about whether the number is real. Claiming
 * more than that on screen would be worse than claiming nothing, because the person reading it would
 * stop checking.
 */
const VAT_SHAPES: Record<string, RegExp> = {
  BG: /^BG\d{9,10}$/,
  RO: /^RO\d{2,10}$/,
  GR: /^EL\d{9}$/,
  DE: /^DE\d{9}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  IT: /^IT\d{11}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  NL: /^NL\d{9}B\d{2}$/,
  AT: /^ATU\d{8}$/,
  PL: /^PL\d{10}$/,
  CZ: /^CZ\d{8,10}$/,
  HU: /^HU\d{8}$/,
  SK: /^SK\d{10}$/,
  HR: /^HR\d{11}$/,
  SI: /^SI\d{8}$/,
  PT: /^PT\d{9}$/,
  BE: /^BE0\d{9}$/,
  IE: /^IE\d[A-Z0-9]\d{5}[A-Z]{1,2}$/,
  DK: /^DK\d{8}$/,
  SE: /^SE\d{12}$/,
  FI: /^FI\d{8}$/,
  CY: /^CY\d{8}[A-Z]$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  EE: /^EE\d{9}$/,
  MT: /^MT\d{8}$/,
};

/** Strip the spaces and dots people paste in, and upper-case it. Never alters the digits. */
export function normaliseVatId(raw: string): string {
  return raw.replace(/[\s.\-/]/g, "").toUpperCase();
}

/**
 * Everything wrong with what they typed, in the order the form shows the fields.
 *
 * Returns every problem at once rather than the first: a form that reveals one fault per submit is
 * the reason people abandon them.
 */
export function validateBillingIdentity(v: BillingIdentity): BillingIdentityProblem[] {
  const problems: BillingIdentityProblem[] = [];

  for (const r of REQUIRED) {
    if (!v[r.field]?.trim()) problems.push({ field: r.field, code: r.code, message: r.message });
  }

  const country = v.country.trim().toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) {
    problems.push({ field: "country", code: "countryShape", message: "Give the country as its two-letter code, for example BG or DE." });
  }

  const vat = normaliseVatId(v.vatId ?? "");
  if (vat) {
    /*
     * Checked against the shape for the country they gave, and only when we know that country's
     * shape. An unknown country is not an error — we sell to whoever turns up — and refusing a
     * perfectly good Swiss VAT number because it is not in the EU list would be a bug that looks
     * like diligence.
     */
    const shape = VAT_SHAPES[country];
    if (shape && !shape.test(vat)) {
      problems.push({
        field: "vatId",
        code: "vatShape",
        message: `That does not look like a ${country} VAT number. It should start with ${country === "GR" ? "EL" : country} — check it against your registration certificate.`,
      });
    }
  }

  if (v.billingEmail?.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.billingEmail.trim())) {
    problems.push({ field: "billingEmail", code: "emailShape", message: "That email address does not look right — invoices sent to it would bounce." });
  }

  return problems;
}

/** True when an invoice could be issued to them today. */
export function canBeInvoiced(v: BillingIdentity): boolean {
  return validateBillingIdentity(v).length === 0;
}

/**
 * What to tell a hotel that has not filled this in.
 *
 * ⚠️ It never threatens their access. A hotel that has not typed its VAT number is not a hotel whose
 * software should stop working — that would be holding a front desk hostage over a form. The honest
 * consequence is the only one: we cannot send them an invoice, which is their problem at the point
 * they need one for their own accounts, and ours every month until they do.
 */
export function billingIdentityPrompt(v: BillingIdentity | null): string | null {
  const facts = billingIdentityGap(v);
  if (!facts) return null;
  if (facts.code === "missing") {
    return "We do not have your company details yet, so we cannot issue you an invoice. It takes a minute and your bookkeeper will need it.";
  }
  return `Your company details are incomplete, so an invoice cannot be issued yet: ${facts.fields
    .map((f) => FIELD_LABEL[f].toLowerCase())
    .join(", ")}.`;
}

/**
 * The same verdict as `billingIdentityPrompt`, as facts rather than a sentence — so a screen in
 * another language can word it without parsing ours. `fields` keeps the form's order and repeats a
 * field once however many things are wrong with it.
 */
export function billingIdentityGap(
  v: BillingIdentity | null,
): null | { code: "missing" } | { code: "incomplete"; fields: BillingIdentityField[] } {
  if (!v) return { code: "missing" };
  const problems = validateBillingIdentity(v);
  if (problems.length === 0) return null;
  return { code: "incomplete", fields: problems.map((p) => p.field) };
}

export const FIELD_LABEL: Record<BillingIdentityField, string> = {
  legalName: "Registered company name",
  country: "Country",
  companyId: "Company number",
  vatId: "VAT number",
  addressLine: "Address",
  city: "City",
  postCode: "Post code",
  billingEmail: "Billing email",
  attention: "For the attention of",
};
