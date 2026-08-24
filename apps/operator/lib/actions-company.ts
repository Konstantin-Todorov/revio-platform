"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { getOperatorSession } from "./session";
import { issueInvoice } from "./invoice-doc";

/**
 * Our own company details, our clients' billing identities, and turning a draft into a real invoice.
 *
 * Both identity forms are `super_admin` only. A legal entity name, a VAT number and a bank account
 * are the fields on the platform where a quiet edit does the most damage: change the IBAN and every
 * subsequent invoice politely asks customers to pay someone else. Support staff have no reason to
 * touch them.
 */

const prisma = forSystem();

export type ActionResult = { ok: boolean; error?: string; message?: string };

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
/** Empty text inputs are absent, not blank — a "" VAT number must not read as "we have one". */
function opt(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}
function int(fd: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
/** ISO 3166-1 alpha-2, upper case. Anything else is rejected rather than stored and misread later. */
function country(fd: FormData, key: string): string | null {
  const raw = str(fd, key).toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : null;
}

export async function saveCompany(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (session?.role !== "super_admin") return { ok: false, error: "Only a super admin can change company details." };

  const legalName = str(fd, "legalName");
  if (!legalName) return { ok: false, error: "Legal company name is required — it is the issuer on every invoice." };
  const c = country(fd, "country");
  if (!c) return { ok: false, error: "Country must be a two-letter code, e.g. BG. It decides the VAT treatment of every invoice." };

  const data = {
    legalName,
    legalNameLatin: opt(fd, "legalNameLatin"),
    vatId: opt(fd, "vatId"),
    companyId: opt(fd, "companyId"),
    addressLine: opt(fd, "addressLine"),
    addressLineLatin: opt(fd, "addressLineLatin"),
    city: opt(fd, "city"),
    cityLatin: opt(fd, "cityLatin"),
    postCode: opt(fd, "postCode"),
    country: c,
    email: opt(fd, "email"),
    phone: opt(fd, "phone"),
    website: opt(fd, "website"),
    iban: opt(fd, "iban"),
    bic: opt(fd, "bic"),
    bankName: opt(fd, "bankName"),
    standardVatPct: int(fd, "standardVatPct", 20),

    paymentTermsDays: int(fd, "paymentTermsDays", 14),
    footerNote: opt(fd, "footerNote"),
  };

  /*
   * The starting number is settable ONCE, and only until the first invoice is issued.
   *
   * Moving it afterwards either repeats a number or leaves a gap, and Bulgarian numbering forbids
   * both — so the field silently going through would be worse than it being missing. Once the
   * counter exists it owns the sequence and this value is only history.
   */
  const started = await prisma.operatorInvoiceSeries.findUnique({ where: { kind: "real" }, select: { id: true } });
  const startRaw = str(fd, "invoiceNumberStart").replace(/\s/g, "");
  let invoiceNumberStart: bigint | undefined;
  if (!started && startRaw) {
    if (!/^\d{1,10}$/.test(startRaw)) {
      return { ok: false, error: "The first invoice number must be up to ten digits, digits only." };
    }
    invoiceNumberStart = BigInt(startRaw);
  }

  const full = invoiceNumberStart === undefined ? data : { ...data, invoiceNumberStart };
  await prisma.operatorCompany.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...full }, update: full });
  revalidatePath("/settings");
  revalidatePath("/billing");
  return { ok: true, message: "Company details saved." };
}

export async function saveClientBilling(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (session?.role !== "super_admin") return { ok: false, error: "Only a super admin can change billing details." };

  const tenantId = str(fd, "tenantId");
  const legalName = str(fd, "legalName");
  if (!tenantId) return { ok: false, error: "Missing client." };
  if (!legalName) {
    return { ok: false, error: "Legal company name is required — the trading name is not who owes the money." };
  }
  const c = country(fd, "country");
  if (!c) return { ok: false, error: "Country must be a two-letter code, e.g. BG. Without it the VAT treatment cannot be decided." };

  const data = {
    legalName,
    legalNameLatin: opt(fd, "legalNameLatin"),
    vatId: opt(fd, "vatId"),
    companyId: opt(fd, "companyId"),
    addressLine: opt(fd, "addressLine"),
    city: opt(fd, "city"),
    postCode: opt(fd, "postCode"),
    country: c,
    billingEmail: opt(fd, "billingEmail"),
    attention: opt(fd, "attention"),
    notes: opt(fd, "notes"),
  };

  await prisma.clientBilling.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  revalidatePath(`/clients/${tenantId}`);
  revalidatePath("/billing");
  return { ok: true, message: "Billing details saved." };
}

/**
 * Issue a draft invoice.
 *
 * Every failure `issueInvoice` can return is a case where the resulting document would be wrong on
 * paper, so the message is surfaced to the operator rather than swallowed. This is the one action in
 * the console whose output goes to somebody else's accountant.
 */
export async function issueInvoiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const id = str(fd, "invoiceId");
  if (!id) return { ok: false, error: "Missing invoice." };

  const result = await issueInvoice(id);
  revalidatePath("/billing");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: `Issued as ${result.number}.` };
}
