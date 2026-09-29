"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEPOSIT_KINDS, FEE_KINDS, PAYMENT_RULES, stayTermsProblems,
  type DepositKind, type FeeKind, type PaymentRule, type StayTermsPolicy,
} from "@revio/core";
import { withTenantTransaction } from "@revio/db";
import { prisma } from "./db";
import { getProperty } from "./data";
import { logAudit, str } from "./mutation-helpers";
import { guard, requireCapability } from "./authz";
import { i18n } from "./i18n/server";
import { terms as termsDict } from "./i18n/terms";

export type ActionResult = { ok: boolean; error?: string; id?: string };

function revalidateTerms() {
  revalidatePath("/rooms-rates", "layout");
}

function oneOf<T extends string>(v: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
/** Blank is "not given" (null), never 0 — a missing deposit must be refused, not charged as zero. */
function optInt(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === "") return null;
  const n = Math.trunc(Number(v.replace(",", ".")));
  return Number.isFinite(n) ? n : null;
}
/** Money typed as "50" or "50,00" → minor units. */
function optMinor(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(/\s/g, "").replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** The form → the terms, exactly as `stayTerms` will read them. Fields that do not apply are nulled. */
function policyFrom(fd: FormData): StayTermsPolicy {
  const payment = oneOf<PaymentRule>(str(fd, "payment"), PAYMENT_RULES, "guarantee");
  const depositKind = payment === "deposit" ? oneOf<DepositKind>(str(fd, "depositKind"), DEPOSIT_KINDS, "first_night") : null;
  const refundable = str(fd, "refundable") !== "no";
  const lateFee = oneOf<FeeKind>(str(fd, "lateFee"), FEE_KINDS, "first_night");
  const noShowFee = oneOf<FeeKind>(str(fd, "noShowFee"), FEE_KINDS, "first_night");
  return {
    payment,
    depositKind,
    depositValue: depositKind === "percent" ? optInt(fd, "depositPercent") : depositKind === "fixed" ? optMinor(fd, "depositFixed") : null,
    balanceDaysBefore: payment !== "prepay" && str(fd, "balance") === "charge" ? optInt(fd, "balanceDaysBefore") ?? 0 : null,
    refundable,
    freeCancelDays: refundable ? optInt(fd, "freeCancelDays") ?? -1 : 0,
    lateFee,
    lateFeePct: lateFee === "percent" ? optInt(fd, "lateFeePct") : null,
    noShowFee,
    noShowFeePct: noShowFee === "percent" ? optInt(fd, "noShowFeePct") : null,
  };
}

export async function saveStayPolicy(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const g = await guard("manageRates");
  if (!g.ok) return { ok: false, error: g.error };
  const { id: propertyId, tenantId } = await getProperty();
  const s = (await i18n()).t(termsDict);

  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return { ok: false, error: s.nameRequired };
  const code = (str(fd, "code") || name.replace(/[^A-Za-zА-Яа-я0-9]+/g, "").slice(0, 6)).toUpperCase();
  const p = policyFrom(fd);
  const problems = stayTermsProblems(p);
  if (problems.length > 0) return { ok: false, error: s.problems[problems[0]!] };

  const clash = await prisma.cancellationPolicy.findFirst({ where: { propertyId, code, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return { ok: false, error: s.codeTaken(code) };

  const data = {
    name, code,
    payment: p.payment, depositKind: p.depositKind ?? null, depositValue: p.depositValue ?? null,
    balanceDaysBefore: p.balanceDaysBefore ?? null, refundable: p.refundable, freeCancelDays: p.freeCancelDays,
    lateFee: p.lateFee, lateFeePct: p.lateFeePct ?? null, noShowFee: p.noShowFee, noShowFeePct: p.noShowFeePct ?? null,
  };
  let savedId = id;
  if (id) {
    const own = await prisma.cancellationPolicy.findFirst({ where: { id, propertyId } });
    if (!own) return { ok: false, error: s.nameRequired };
    await prisma.cancellationPolicy.update({ where: { id }, data });
    await logAudit(propertyId, tenantId, { entity: `Terms · ${name}`, field: "edit", newValue: name });
  } else {
    const row = await prisma.cancellationPolicy.create({ data: { tenantId, propertyId, ...data } });
    savedId = row.id;
    await logAudit(propertyId, tenantId, { entity: `Terms · ${name}`, field: "create", newValue: name });
  }
  revalidateTerms();
  if (!id) redirect(`/rooms-rates/terms/${savedId}`);
  return { ok: true, id: savedId };
}

export async function deleteStayPolicy(fd: FormData): Promise<void> {
  await requireCapability("manageRates");
  const { id: propertyId, tenantId } = await getProperty();
  const id = str(fd, "id");
  const row = await prisma.cancellationPolicy.findFirst({ where: { id, propertyId } });
  if (row) {
    // One transaction: plans are unlinked and the terms removed together, or neither.
    await withTenantTransaction(tenantId, async (tx) => {
      await tx.ratePlan.updateMany({ where: { propertyId, cancellationPolicyId: id }, data: { cancellationPolicyId: null } });
      await tx.cancellationPolicy.delete({ where: { id } });
    });
    await logAudit(propertyId, tenantId, { entity: `Terms · ${row.name}`, field: "delete", oldValue: row.name });
  }
  revalidateTerms();
  redirect("/rooms-rates/terms");
}

export async function setPlanTerms(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const g = await guard("manageRates");
  if (!g.ok) return { ok: false, error: g.error };
  const { id: propertyId, tenantId } = await getProperty();
  const planId = str(fd, "ratePlanId");
  const policyId = str(fd, "policyId") || null;
  const plan = await prisma.ratePlan.findFirst({ where: { id: planId, propertyId } });
  if (!plan) return { ok: false };
  if (policyId && !(await prisma.cancellationPolicy.findFirst({ where: { id: policyId, propertyId } }))) return { ok: false };
  await prisma.ratePlan.update({ where: { id: planId }, data: { cancellationPolicyId: policyId } });
  await logAudit(propertyId, tenantId, { entity: `Rate Plan · ${plan.name}`, field: "terms", newValue: policyId ?? "none" });
  revalidateTerms();
  return { ok: true };
}
