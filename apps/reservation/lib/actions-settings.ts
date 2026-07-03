"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { getProperty } from "./data";
import { logAudit, str, int } from "./mutation-helpers";
import { PERMISSION_GROUPS } from "./permissions";



const LEVELS = new Set(["none", "view", "edit"]);

/** Roles = saved combinations of group × access level — new roles are configuration, not code. */
export async function savePermissionRole(fd: FormData): Promise<void> {
  const property = await getProperty();
  const tenantId = property.tenantId;
  const rowId = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return;

  const access = PERMISSION_GROUPS.map((group) => {
    const level = str(fd, `level_${group}`);
    return { group, level: LEVELS.has(level) ? level : "none" };
  });

  if (rowId) {
    const role = await prisma.permissionRole.findFirst({ where: { id: rowId, tenantId } });
    if (!role) return;
    await prisma.permissionRole.update({ where: { id: rowId }, data: { name: role.builtin ? role.name : name } });
    for (const a of access) {
      await prisma.roleAccess.upsert({
        where: { roleId_group: { roleId: rowId, group: a.group } },
        create: { tenantId, roleId: rowId, group: a.group, level: a.level },
        update: { level: a.level },
      });
    }
    await logAudit(property.id, tenantId, { entity: `Permission role · ${role.name}`, field: "access updated" });
  } else {
    const clash = await prisma.permissionRole.findFirst({ where: { tenantId, name } });
    if (clash) return;
    await prisma.permissionRole.create({
      data: { tenantId, name, builtin: false, access: { create: access.map((a) => ({ tenantId, ...a })) } },
    });
    await logAudit(property.id, tenantId, { entity: `Permission role · ${name}`, field: "created" });
  }
  revalidatePath("/settings");
}

export async function deletePermissionRole(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const role = await prisma.permissionRole.findFirst({ where: { id, tenantId: property.tenantId } });
  if (!role || role.builtin) return; // the V1 roles are fixed
  await prisma.permissionRole.delete({ where: { id } });
  await logAudit(property.id, property.tenantId, { entity: `Permission role · ${role.name}`, field: "deleted" });
  revalidatePath("/settings");
}

/** Taxes & Fees — type (percent|fixed), basis, inclusion (feeds Room Revenue display rules). */
export async function saveTaxFee(fd: FormData): Promise<void> {
  const property = await getProperty();
  const rowId = str(fd, "id");
  const name = str(fd, "name");
  if (!name) return;

  const type = str(fd, "type") === "percent" ? "percent" : "fixed";
  const data = {
    name,
    type,
    pct: type === "percent" ? Math.max(0, Number(str(fd, "pct") || "0")) : null,
    amountMinor: type === "fixed" ? Math.max(0, Math.round(Number(str(fd, "amount") || "0") * 100)) : null,
    basis: ["per_room", "per_person", "per_night", "per_stay"].includes(str(fd, "basis")) ? str(fd, "basis") : "per_stay",
    inclusion: str(fd, "inclusion") === "included" ? "included" : "excluded",
    active: fd.get("active") != null,
  };

  if (rowId) {
    const existing = await prisma.taxFee.findFirst({ where: { id: rowId, propertyId: property.id } });
    if (!existing) return;
    await prisma.taxFee.update({ where: { id: rowId }, data });
  } else {
    await prisma.taxFee.create({ data: { tenantId: property.tenantId, propertyId: property.id, ...data } });
  }
  await logAudit(property.id, property.tenantId, {
    entity: `Tax/Fee · ${name}`,
    field: rowId ? "updated" : "created",
    newValue: `${type === "percent" ? `${data.pct}%` : `€${((data.amountMinor ?? 0) / 100).toFixed(2)}`} ${data.basis.replace("_", " ")} · ${data.inclusion}`,
  });
  revalidatePath("/settings");
}

export async function deleteTaxFee(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const tax = await prisma.taxFee.findFirst({ where: { id, propertyId: property.id } });
  if (!tax) return;
  await prisma.taxFee.delete({ where: { id } });
  await logAudit(property.id, property.tenantId, { entity: `Tax/Fee · ${tax.name}`, field: "deleted" });
  revalidatePath("/settings");
}
