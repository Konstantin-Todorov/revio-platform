"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { roomTypeRemoval } from "@revio/core";
import { writeWelcomeRoomType } from "@revio/db";
import { flashError, setFlash } from "@revio/ui/flash";
import { fill } from "@revio/ui/i18n";
import { roomRulesStrings } from "@revio/ui/room-rules-strings";
import { welcomeStrings } from "@revio/ui/welcome-strings";
import { prisma } from "./db";
import { getSession } from "./session";
import { roleHasCapability, roleHome, type Capability } from "./roles";
import { logAudit, str } from "./mutation-helpers";
import { i18n } from "./i18n/server";
import { flash } from "./i18n/flash";
import { roomTypesOwner } from "./unit-plan";

/**
 * Room types, edited from RevioPMS — for a hotel that runs RevioPMS alone.
 *
 * ## Why this exists
 *
 * Until 2026-09-28 a RevioPMS-only hotel could create room types in its first-run flow and never
 * again: the Rooms screen told it they were "defined in RevioLink / RevioCRS" — products it does not
 * have. A renovation, a miscounted type, a new annex, and the hotel was stuck with no screen to go to.
 *
 * ## Why only when RevioPMS is alone
 *
 * Once RevioLink or RevioCRS is on the account, a room type's count is what every channel sells, and
 * changing it has to go where the availability push lives. Those hotels are told where that is.
 */
export type RoomTypeResult = { ok: boolean; error?: string };

async function ctx(cap: Capability): Promise<{ ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roleHasCapability(session.role, cap)) redirect(roleHome(session.role));
  const owner = roomTypesOwner(session.entitlements);
  if (owner) {
    const r = (await i18n()).t(roomRulesStrings);
    return { ok: false, error: fill(r.editor.managedIn, { product: owner }) };
  }
  return { ok: true, session };
}

function refresh() {
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
}

export async function addRoomType(_prev: RoomTypeResult | null, fd: FormData): Promise<RoomTypeResult> {
  const g = await ctx("manage");
  if (!g.ok) return { ok: false, error: g.error };
  const res = await writeWelcomeRoomType(
    { tenantId: g.session.tenantId, propertyId: g.session.activePropertyId },
    { name: str(fd, "name"), totalRooms: str(fd, "totalRooms"), maxGuests: str(fd, "maxGuests") },
  );
  if (res.error) {
    const { t } = await i18n();
    const errors = t(welcomeStrings).errors as Record<string, string>;
    return { ok: false, error: (res.code && errors[res.code]) || res.error };
  }
  await logAudit(g.session.activePropertyId, g.session.tenantId, { entity: "roomType", field: "create", newValue: str(fd, "name"), userId: g.session.userId });
  refresh();
  return { ok: true };
}

export async function updateRoomType(_prev: RoomTypeResult | null, fd: FormData): Promise<RoomTypeResult> {
  const g = await ctx("manage");
  if (!g.ok) return { ok: false, error: g.error };
  const { t } = await i18n();
  const errors = t(welcomeStrings).errors as Record<string, string>;
  const r = t(roomRulesStrings);

  const rt = await prisma.roomType.findUnique({ where: { id: str(fd, "id") }, include: { _count: { select: { units: true } } } });
  // Gone and not-yours read the same, so the form cannot be used to probe another property's ids.
  if (!rt || rt.propertyId !== g.session.activePropertyId) return { ok: false, error: errors.roomtype_name ?? "" };

  const name = str(fd, "name").trim();
  const rooms = Number.parseInt(str(fd, "totalRooms"), 10);
  const guests = Number.parseInt(str(fd, "maxGuests"), 10);
  if (!name) return { ok: false, error: errors.roomtype_name! };
  if (!Number.isFinite(rooms) || rooms < 1) return { ok: false, error: errors.roomtype_count! };
  if (!Number.isFinite(guests) || guests < 1) return { ok: false, error: errors.roomtype_guests! };
  // The count is what is sold; the doors already built under it cannot outnumber it.
  if (rooms < rt._count.units) {
    return { ok: false, error: fill(r.countBelowRooms, { type: rt.name, existing: rt._count.units }) };
  }

  await prisma.roomType.update({ where: { id: rt.id }, data: { name, totalRooms: rooms, maxGuests: guests } });
  await logAudit(g.session.activePropertyId, g.session.tenantId, {
    entity: "roomType", field: "edit", oldValue: `${rt.name} · ${rt.totalRooms}`, newValue: `${name} · ${rooms}`, userId: g.session.userId,
  });
  refresh();
  return { ok: true };
}

export async function removeRoomType(fd: FormData): Promise<void> {
  const g = await ctx("manage");
  if (!g.ok) return flashError(g.error);
  const rt = await prisma.roomType.findUnique({
    where: { id: str(fd, "id") },
    include: { _count: { select: { resLines: true, units: true } } },
  });
  // Gone and not-yours read the same, so the button cannot probe another property's ids.
  if (!rt || rt.propertyId !== g.session.activePropertyId) return flashError((await i18n()).t(flash).units.typeGone);

  const mapped = await prisma.channelRoomTypeMapping.count({ where: { roomTypeId: rt.id, externalRoomId: { not: null } } });
  const verdict = roomTypeRemoval({ mapped, reservations: rt._count.resLines, units: rt._count.units });
  const r = (await i18n()).t(roomRulesStrings);
  if (verdict === "blocked_mapped") return flashError(fill(r.mappedWelcome, { name: rt.name }));
  if (verdict === "deactivate") {
    await prisma.roomType.update({ where: { id: rt.id }, data: { active: false } });
    await logAudit(g.session.activePropertyId, g.session.tenantId, { entity: "roomType", field: "deactivate", newValue: rt.name, userId: g.session.userId });
    await setFlash("success", fill(r.deactivated, { name: rt.name }));
  } else {
    await prisma.roomType.delete({ where: { id: rt.id } });
    await logAudit(g.session.activePropertyId, g.session.tenantId, { entity: "roomType", field: "delete", oldValue: rt.name, userId: g.session.userId });
  }
  refresh();
}
