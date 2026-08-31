"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claimRegisterNo, withTenantTransaction } from "@revio/db";
import { normaliseCountryCode } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, type Capability } from "./roles";
import { logAudit, str } from "./mutation-helpers";

/**
 * Register actions — регистър на настанените туристи (чл. 116 ЗТ).
 *
 * `frontDesk`, because reception is who reads the passport. Not `manage`: a register nobody on the
 * desk can complete is a register that gets kept on paper instead.
 */
async function ctx(capability: Capability) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roleHasCapability(session.role, capability)) redirect("/dashboard?error=forbidden");
  return session;
}

function optional(fd: FormData, key: string): string | null {
  const v = str(fd, key).trim();
  return v === "" ? null : v;
}

/** A date input's value, or null. Stored as a plain UTC day — a birth date has no timezone. */
function optionalDate(fd: FormData, key: string): Date | null {
  const v = str(fd, key).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Complete or correct one person's register entry. */
export async function saveStayGuest(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const id = str(fd, "id");

  const row = await prisma.stayGuest.findFirst({
    where: { id, propertyId: session.activePropertyId },
    select: { id: true, reservationId: true, registerNo: true, fullName: true },
  });
  if (!row) redirect("/dashboard");

  const sexRaw = str(fd, "sex");
  const nationality = normaliseCountryCode(str(fd, "nationality"));

  await prisma.stayGuest.update({
    where: { id: row!.id },
    data: {
      fullName: str(fd, "fullName").trim(),
      personalId: optional(fd, "personalId"),
      dateOfBirth: optionalDate(fd, "dateOfBirth"),
      sex: sexRaw === "m" || sexRaw === "f" ? sexRaw : null,
      nationality,
      documentNumber: optional(fd, "documentNumber"),
      // Kept even when the citizenship makes it unnecessary: a correction from "Serbian" to
      // "Croatian" should not silently discard a series somebody typed off a passport.
      documentSeries: optional(fd, "documentSeries"),
      documentCountry: normaliseCountryCode(str(fd, "documentCountry")),
      touristPackage: fd.get("touristPackage") != null,
    },
  });

  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "guest_register",
    field: `№${row!.registerNo}`,
    oldValue: row!.fullName || "(blank)",
    // The identity details themselves are NOT written to the audit trail. The trail is read by more
    // people than the register is, and copying a document number into it widens the exposure of the
    // most sensitive field we hold for no investigative gain.
    newValue: `${str(fd, "fullName").trim() || "(blank)"} · details updated`,
    userId: session.userId,
  });

  revalidatePath(`/reservation/${row!.reservationId}`);
  revalidatePath("/register");
}

/** Add a person who is not on the booking — the companion who turned up. */
export async function addStayGuest(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const reservationId = str(fd, "reservationId");

  const res = await prisma.reservation.findFirst({
    where: { id: reservationId, propertyId: session.activePropertyId },
    select: { id: true },
  });
  if (!res) redirect("/dashboard");

  // The room is taken from a sibling entry rather than re-derived: every person on a stay is in one
  // of its rooms, and the register wants the room they slept in, not the one the stay is filed under.
  const sibling = await prisma.stayGuest.findFirst({
    where: { reservationId },
    orderBy: { registerNo: "asc" },
    select: { unitLabel: true, floor: true, registeredAt: true },
  });

  await withTenantTransaction(session.tenantId, async (tx) => {
    const registerNo = await claimRegisterNo(tx, session.activePropertyId);
    await tx.stayGuest.create({
      data: {
        tenantId: session.tenantId,
        propertyId: session.activePropertyId,
        reservationId,
        registerNo,
        registeredAt: sibling?.registeredAt ?? new Date(),
        fullName: "",
        unitLabel: sibling?.unitLabel ?? null,
        floor: sibling?.floor ?? null,
      },
    });
  });

  revalidatePath(`/reservation/${reservationId}`);
  revalidatePath("/register");
}

/**
 * Remove an entry added in error.
 *
 * Only a BLANK one. A completed entry is a registration that happened, and the order requires the
 * register to be kept for a minimum of two years — deleting it is not a correction, it is the thing
 * the retention rule exists to prevent. An over-counted party leaves a blank row; a real guest does
 * not.
 */
export async function removeStayGuest(fd: FormData): Promise<void> {
  const session = await ctx("frontDesk");
  const id = str(fd, "id");

  const row = await prisma.stayGuest.findFirst({
    where: { id, propertyId: session.activePropertyId },
  });
  if (!row) redirect("/dashboard");

  const captured =
    (row!.fullName?.trim() ?? "") !== "" ||
    row!.personalId != null || row!.documentNumber != null ||
    row!.dateOfBirth != null || row!.nationality != null;

  if (captured) {
    redirect(`/reservation/${row!.reservationId}?error=register_kept`);
  }

  await prisma.stayGuest.delete({ where: { id: row!.id } });
  await logAudit(session.activePropertyId, session.tenantId, {
    entity: "guest_register", field: `№${row!.registerNo}`,
    oldValue: "(blank entry)", newValue: "removed — nothing had been captured",
    userId: session.userId,
  });

  revalidatePath(`/reservation/${row!.reservationId}`);
  revalidatePath("/register");
}
