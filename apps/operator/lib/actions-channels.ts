"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { pauseChannel, resumeChannel, disconnectChannel, reconnectChannel, activateChannexChannel, channexApiConfig } from "@revio/connectivity";
import { flashError, setFlash } from "@revio/ui/flash";
import { getOperatorSession } from "./session";

/**
 * Operator-side controls for one client's channels.
 *
 * ## Why these live here and not only in the hotel's own product
 *
 * Every one of them already existed in RevioLink, where the hotel presses them. That is no use for
 * the two cases that actually come up: a **suspended** client, whose staff cannot sign in at all,
 * and a channel pointed at a property the OTA no longer has, which the hotel has no way to
 * recognise. Both were found on real accounts on 2026-09-17 and neither could be fixed by anybody,
 * from anywhere, without a database console.
 *
 * The RULES are not re-implemented here — pause/resume/disconnect/reconnect call the same functions
 * the hotel's buttons call, through the system perimeter. A second copy of a lifecycle rule is a
 * second chance to disagree with it.
 */

// The operator perimeter sees every tenant → bypass RLS.
const prisma = forSystem();

async function channelOf(channelId: string) {
  return prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, name: true, propertyId: true, tenantId: true, status: true, property: { select: { name: true } } },
  });
}

/**
 * Switch a connected-but-not-live channel on at Channex, so the OTA starts selling.
 *
 * ## ⚠️ Why this is here and not on the hotel's own screen
 *
 * **We are the Channex customer, not the hotel** — one organisation, one key, every property. A
 * hotel has no Channex account and is never asked for one, so it physically cannot switch its own
 * channel on. RevioLink has been telling hotels since 26 August that "nothing goes on sale until you
 * activate it", pointing at a door they have no key to, and there was no door on our side either:
 * `activateChannexChannel` was written that day and never called from anywhere. Cabacum's channel is
 * live because somebody logged into Channex and flipped it by hand.
 *
 * ## ⚠️ It is the billable moment
 *
 * Channex charges per property with an active channel. This is where that charge starts, which is
 * why it says so and why it is one deliberate click rather than the tail end of a create.
 *
 * ## Refused with nothing mapped
 *
 * A channel switched on with no room type carrying an external id publishes nothing and looks live —
 * the exact state this console spent today learning to recognise. Better to refuse and say why.
 */
export async function operatorActivateChannel(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again.");
  const id = String(fd.get("channelId") ?? "");
  const ch = await prisma.channel.findUnique({
    where: { id },
    select: {
      id: true, name: true, status: true, tenantId: true, connectivityMode: true,
      externalChannelId: true, property: { select: { name: true } },
    },
  });
  if (!ch) return flashError("That channel no longer exists.");
  if (ch.status !== "pending") return flashError(`${ch.name} is already ${ch.status}.`);
  if (!ch.externalChannelId) {
    return flashError(`${ch.name} has no channel id at Channex — it was never created there, so there is nothing to switch on.`);
  }

  const mapped = await prisma.channelRoomTypeMapping.count({
    where: { channelId: id, externalRoomId: { not: null } },
  });
  if (mapped === 0) {
    return flashError(
      `${ch.property.name} · ${ch.name} has no room type mapped to the channel yet. Switching it on now would ` +
      "put it live with nothing to send — it would read as working and sell nothing. Finish the mapping first.",
    );
  }

  try {
    const cfg = await channexApiConfig(ch.tenantId, ch.connectivityMode);
    await activateChannexChannel(cfg, ch.externalChannelId);
  } catch (e) {
    return flashError(`Channex refused to switch ${ch.name} on: ${e instanceof Error ? e.message : "unknown error"}`);
  }
  await prisma.channel.update({
    where: { id },
    data: { status: "connected", externalChannelActive: true },
  });
  await setFlash(
    "success",
    `${ch.property.name} · ${ch.name} is live — the OTA is selling through it, and Channex is now billing us for that property.`,
  );
  revalidatePath(`/clients/${ch.tenantId}`);
}

/** Pause: a stop-sell overlay on the OTA. Reversible, mappings untouched. */
export async function operatorPauseChannel(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again.");
  const id = String(fd.get("channelId") ?? "");
  const ch = await channelOf(id);
  if (!ch) return flashError("That channel no longer exists.");

  const r = await pauseChannel(prisma, id);
  if (!r.ok) return flashError(r.error ?? `${ch.name} could not be paused.`);
  await setFlash("success", `${ch.property.name} · ${ch.name} is paused — the OTA is stop-sold until it is resumed.`);
  revalidatePath(`/clients/${ch.tenantId}`);
}

export async function operatorResumeChannel(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again.");
  const id = String(fd.get("channelId") ?? "");
  const ch = await channelOf(id);
  if (!ch) return flashError("That channel no longer exists.");

  const r = await resumeChannel(prisma, id);
  if (!r.ok) return flashError(r.error ?? `${ch.name} could not be resumed.`);
  await setFlash("success", `${ch.property.name} · ${ch.name} is live again.`);
  revalidatePath(`/clients/${ch.tenantId}`);
}

export async function operatorDisconnectChannel(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again.");
  const id = String(fd.get("channelId") ?? "");
  const ch = await channelOf(id);
  if (!ch) return flashError("That channel no longer exists.");

  const r = await disconnectChannel(prisma, id);
  if (!r.ok) return flashError(r.error ?? `${ch.name} could not be disconnected.`);
  await setFlash("success", `${ch.property.name} · ${ch.name} is disconnected. Its mappings are kept — reconnecting restores them.`);
  revalidatePath(`/clients/${ch.tenantId}`);
}

export async function operatorReconnectChannel(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again.");
  const id = String(fd.get("channelId") ?? "");
  const ch = await channelOf(id);
  if (!ch) return flashError("That channel no longer exists.");

  const r = await reconnectChannel(prisma, id);
  if (!r.ok) return flashError(r.error ?? `${ch.name} could not be reconnected.`);
  await setFlash("success", `${ch.property.name} · ${ch.name} is connected again.`);
  revalidatePath(`/clients/${ch.tenantId}`);
}

/**
 * Remove a channel entirely.
 *
 * ## ⚠️ `Reservation.channel` is `onDelete: Cascade`
 *
 * Deleting a Channel row **deletes every reservation that arrived through it**, with its guests, its
 * folio lines and its money. Postgres does that silently and instantly, and no part of this console
 * would say what had gone.
 *
 * So a channel that has ever produced a reservation **cannot be deleted here, at all** — not behind
 * a confirmation, not behind a role gate. Disconnect is the answer for that case and it is what the
 * refusal says. The delete exists for the case it is genuinely for: a channel connected to the wrong
 * thing that never produced anything, like a property the OTA has since removed.
 *
 * ⚠️ It does NOT delete anything on the channel's side. Channex keeps its own property and channel,
 * and if that is the duplicate somebody is trying to clean up it has to go in Channex too. Saying so
 * is the difference between a control somebody can trust and one that leaves half a job done.
 */
export async function operatorDeleteChannel(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again.");

  const id = String(fd.get("channelId") ?? "");
  const typed = String(fd.get("confirmation") ?? "").trim();
  const ch = await channelOf(id);
  if (!ch) return flashError("That channel no longer exists.");

  // The name, typed. The same bar the client deletion uses, for the same reason: the row you are
  // about to remove and the row you meant to remove are one careless click apart in a table.
  if (typed.toLowerCase() !== ch.name.trim().toLowerCase()) {
    return flashError(`Type the channel's name exactly ("${ch.name}") to remove it.`);
  }

  const reservations = await prisma.reservation.count({ where: { channelId: id } });
  if (reservations > 0) {
    return flashError(
      `${ch.name} has ${reservations} reservation${reservations === 1 ? "" : "s"}, and removing it would delete ` +
      `${reservations === 1 ? "that booking" : "those bookings"} with ${reservations === 1 ? "its" : "their"} guests and folios. ` +
      "Disconnect it instead — that stops all traffic and keeps the history.",
    );
  }

  await prisma.channel.delete({ where: { id } });
  await setFlash(
    "success",
    `${ch.property.name} · ${ch.name} removed, with its mappings. Nothing was deleted on the channel's own side — ` +
    "if there is a property to clean up there, it still needs doing in their console.",
  );
  revalidatePath(`/clients/${ch.tenantId}`);
}
