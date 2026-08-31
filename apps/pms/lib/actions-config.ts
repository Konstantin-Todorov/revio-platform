"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getSession } from "./session";
import { logAudit, str, int } from "./mutation-helpers";
import { MANAGER_ROLES } from "./roles";

async function requireManager() {
  const s = await getSession();
  if (!s || !MANAGER_ROLES.has(s.role)) return null;
  return s;
}

function refresh() {
  revalidatePath("/configuration");
  revalidatePath("/housekeeping");
  revalidatePath("/dashboard");
}

/** Save the tax / invoicing / compliance / housekeeping-gate config (spec §3.10). Upserts the
 * single PropertyDefaults row so a property that never touched CRS settings still gets one. */
export async function saveConfiguration(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const propertyId = s.activePropertyId;
  const data = {
    vatStandardPct: Math.max(0, Math.min(100, int(fd, "vatStandardPct", 20))),
    vatReducedPct: Math.max(0, Math.min(100, int(fd, "vatReducedPct", 9))),
    // Null when cleared, rather than 0. A rate of zero is a rate somebody set; an empty field is a
    // rate nobody has stated yet, and the register screen has to be able to say which.
    touristTaxRateMinor: money2minor(fd, "touristTaxRate"),
    touristTaxBeds: positiveOrNull(fd, "touristTaxBeds"),
    cityTaxMode: str(fd, "cityTaxMode") === "included" ? "included" : "payable_on_spot",
    invoiceIssuerName: str(fd, "invoiceIssuerName") || null,
    invoiceVatId: str(fd, "invoiceVatId") || null,
    invoiceAddress: str(fd, "invoiceAddress") || null,
    inspectionGate: fd.get("inspectionGate") != null,
    autoAssignEnabled: fd.get("autoAssignEnabled") != null,
    jurisdiction: ["generic", "bg", "eu"].includes(str(fd, "jurisdiction")) ? str(fd, "jurisdiction") : "generic",
    fiscalizationEnabled: fd.get("fiscalizationEnabled") != null,
    eInvoicingEnabled: fd.get("eInvoicingEnabled") != null,
    // Close Day escalation (§3.4). Per-property because the business-day boundary already varies —
    // some properties audit at 03:00, some at midnight — so one fixed time fits nobody.
    // Clamped rather than trusted: a deadline outside the day, or a zero-hour window, would make
    // the reminder stage vanish and turn every overdue day into an immediate unattended close.
    closeDeadlineMinutes: Math.max(0, Math.min(1439, int(fd, "closeDeadlineMinutes", 30))),
    closeReminderWindowHours: Math.max(1, Math.min(72, int(fd, "closeReminderWindowHours", 22))),
    autoCloseEnabled: fd.get("autoCloseEnabled") != null,
  };
  await prisma.propertyDefaults.upsert({
    where: { propertyId },
    create: { tenantId: s.tenantId, propertyId, ...data },
    update: data,
  });
  await logAudit(propertyId, s.tenantId, { entity: "configuration", field: "tax/invoicing", newValue: `VAT ${data.vatStandardPct}/${data.vatReducedPct}, gate ${data.inspectionGate}`, userId: s.userId });
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
  revalidatePath("/configuration");
}

export async function deleteDepositType(fd: FormData): Promise<void> {
  const s = await requireManager();
  if (!s) return;
  const id = str(fd, "id");
  const t = await prisma.depositType.findFirst({ where: { id, propertyId: s.activePropertyId }, select: { id: true, name: true } });
  if (!t) return;
  await prisma.depositType.delete({ where: { id } });
  await logAudit(s.activePropertyId, s.tenantId, { entity: "deposit_type", field: t.name, newValue: "deleted", userId: s.userId });
  revalidatePath("/configuration");
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
