"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { logAudit, str, int } from "./mutation-helpers";
import { MANAGER_ROLES } from "./roles";
import { FISCAL_TAX_GROUPS } from "@revio/core";
import { withTenantTransaction, writeTouristTax } from "@revio/db";

async function requireManager() {
  const s = await getSession();
  if (!s || !MANAGER_ROLES.has(s.role)) return null;
  return s;
}

function refresh() {
  revalidatePath("/configuration", "layout");
  revalidatePath("/housekeeping");
  revalidatePath("/dashboard");
}

/** Save the tax / invoicing / compliance / housekeeping-gate config (spec §3.10). Upserts the
 * single PropertyDefaults row so a property that never touched CRS settings still gets one. */
export async function saveConfiguration(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const propertyId = s.activePropertyId;
  /*
   * Configuration is one section per page (Taxes · Invoices · Housekeeping · End of day ·
   * Compliance), each with its own form and its own save. `section` names the fields a form carries,
   * and only those are written — a form that posted one section while this wrote all five would
   * switch every checkbox of the other four off (an absent checkbox reads as "off").
   */
  const section = str(fd, "section");
  const bySection: Record<string, Record<string, unknown>> = {
    taxes: {
      vatStandardPct: Math.max(0, Math.min(100, int(fd, "vatStandardPct", 20))),
      vatReducedPct: Math.max(0, Math.min(100, int(fd, "vatReducedPct", 9))),
      touristTaxBeds: positiveOrNull(fd, "touristTaxBeds"),
      cityTaxMode: str(fd, "cityTaxMode") === "included" ? "included" : "payable_on_spot",
    },
    invoices: {
      invoiceIssuerName: str(fd, "invoiceIssuerName") || null,
      invoiceVatId: str(fd, "invoiceVatId") || null,
      invoiceAddress: str(fd, "invoiceAddress") || null,
    },
    housekeeping: {
      inspectionGate: fd.get("inspectionGate") != null,
      autoAssignEnabled: fd.get("autoAssignEnabled") != null,
    },
    compliance: {
      jurisdiction: ["generic", "bg", "eu"].includes(str(fd, "jurisdiction")) ? str(fd, "jurisdiction") : "generic",
      fiscalizationEnabled: fd.get("fiscalizationEnabled") != null,
      eInvoicingEnabled: fd.get("eInvoicingEnabled") != null,
      estiPlaceUin: str(fd, "estiPlaceUin").slice(0, 500) || null,
      fiscalDevice: str(fd, "fiscalDevice") === "erpnet" ? "erpnet" : "none",
      fiscalTaxGroups: fiscalGroupsFrom(fd),
    },
    // Close Day escalation (§3.4). Per-property because the business-day boundary already varies —
    // some properties audit at 03:00, some at midnight — so one fixed time fits nobody.
    // Clamped rather than trusted: a deadline outside the day, or a zero-hour window, would make
    // the reminder stage vanish and turn every overdue day into an immediate unattended close.
    endOfDay: {
      closeDeadlineMinutes: Math.max(0, Math.min(1439, int(fd, "closeDeadlineMinutes", 30))),
      closeReminderWindowHours: Math.max(1, Math.min(72, int(fd, "closeReminderWindowHours", 22))),
      autoCloseEnabled: fd.get("autoCloseEnabled") != null,
    },
  };
  const data = bySection[section];
  if (!data) return;
  await withTenantTransaction(s.tenantId, async (tx) => {
    await tx.propertyDefaults.upsert({
      where: { propertyId },
      create: { tenantId: s.tenantId, propertyId, ...data },
      update: data,
    });
    // The tourist tax rate is not a PMS column: it is the one row the guest is charged by, which
    // RevioCRS edits too (`@revio/db` tourist-tax.ts). Empty clears it — a rate nobody stated.
    if (section === "taxes") await writeTouristTax(tx, { tenantId: s.tenantId, propertyId }, money2minor(fd, "touristTaxRate"));
  });
  await logAudit(propertyId, s.tenantId, { entity: "configuration", field: section, newValue: JSON.stringify(data), userId: s.userId });
  refresh();
}

// --- Deposit types (spec §4.4) -------------------------------------------------
export async function saveDepositType(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return;
  const data = {
    name,
    behaviour: str(fd, "behaviour") === "applied" ? "applied" : "held",
    vatTiming: str(fd, "vatTiming") === "capture" ? "capture" : "use",
    active: fd.get("active") != null,
  };
  if (id) {
    const t = await prisma.depositType.findFirst({ where: { id, propertyId: s.activePropertyId }, select: { id: true } });
    if (t) await prisma.depositType.update({ where: { id }, data });
  } else {
    const count = await prisma.depositType.count({ where: { propertyId: s.activePropertyId } });
    await prisma.depositType.create({ data: { tenantId: s.tenantId, propertyId: s.activePropertyId, ...data, active: true, sortOrder: count } });
  }
  await logAudit(s.activePropertyId, s.tenantId, { entity: "deposit_type", field: name, newValue: `${data.behaviour}/${data.vatTiming}`, userId: s.userId });
  revalidatePath("/configuration", "layout");
}

export async function deleteDepositType(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const t = await prisma.depositType.findFirst({ where: { id, propertyId: s.activePropertyId }, select: { id: true, name: true } });
  if (!t) return;
  await prisma.depositType.delete({ where: { id } });
  await logAudit(s.activePropertyId, s.tenantId, { entity: "deposit_type", field: t.name, newValue: "deleted", userId: s.userId });
  revalidatePath("/configuration", "layout");
}

/** A decimal amount typed into a form, as minor units. Null for a blank or unparseable field. */
function money2minor(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? "").trim().replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

function positiveOrNull(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** The four tax-category → Н-18 group choices, kept only when every one is a real group letter. */
function fiscalGroupsFrom(fd: FormData): { standard: string; reduced: string; city_tax: string; exempt: string } | undefined {
  const pick = (k: string) => str(fd, `fiscalGroup_${k}`);
  const v = { standard: pick("standard"), reduced: pick("reduced"), city_tax: pick("city_tax"), exempt: pick("exempt") };
  return Object.values(v).every((g) => (FISCAL_TAX_GROUPS as readonly string[]).includes(g)) ? v : undefined;
}
