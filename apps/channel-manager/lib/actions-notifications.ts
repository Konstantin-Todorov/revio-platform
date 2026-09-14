"use server";

import { revalidatePath } from "next/cache";
import { clearedAtFor, type NotificationFeed } from "@revio/core";
import { prisma } from "./db";
import { getSession } from "./session";
import { getNotificationFeed } from "./notifications";
import { MAX_READ_KEYS, isNotificationKey, pruneReadKeys } from "./notification-keys";

/**
 * Reading the feed, and recording that you have read it.
 *
 * ## Why these are not capability-gated
 *
 * They write nothing but **your own** read state, on your own account row. There is no capability
 * for "may mark your own notification read" for the same reason there is none for signing yourself
 * out, and inventing one would be a permission that can only ever be granted. The gate that matters
 * is where the data is: `getNotificationFeed` refuses a role that cannot open this product, and
 * filters every event and every attention line to the screens that role may see.
 */

/** Polling. Returns the whole feed, because the unread count needs the read state to compute. */
export async function loadNotifications(): Promise<NotificationFeed> {
  return getNotificationFeed();
}

/**
 * One item read — from clicking it.
 *
 * ⚠️ **One statement, and that is deliberate.** The obvious version reads the array, checks for the
 * key, appends and writes it back; two people clicking two notifications in the same second then
 * race, and the second write silently drops the first person's key because it was built from a
 * snapshot taken before it existed. Appending in the database, guarded by its own `WHERE`, makes it
 * idempotent and race-free — the same shape the Stripe webhook uses to mark an invoice paid once.
 *
 * The slice caps the column in the same statement, so it cannot grow without bound. Losing the
 * oldest key is harmless: anything that old is older than the last "mark all read" in every
 * practical case, and the worst outcome is one already-seen line briefly showing bold again.
 */
export async function markNotificationRead(key: string): Promise<void> {
  const session = await getSession();
  // Nothing to say to anyone: no session means a crafted POST, and a malformed key means the same.
  if (!session || !isNotificationKey(key)) return;

  /* ⚠️ The "already read?" check lives in the WHERE, not in application code. Read-modify-write
     loses one of two clicks in the same second: the second write is built from a snapshot taken
     before the first key existed, so it silently drops it. This is the same idempotent-by-WHERE
     shape the Stripe webhook uses to mark an invoice paid exactly once. */
  await prisma.user.updateMany({
    where: { id: session.userId, NOT: { notificationsReadKeys: { has: key } } },
    data: { notificationsReadKeys: { push: key } },
  });

  /* Keeping the column bounded is a SECOND statement, deliberately.
     ⚠️ Prisma cannot push and trim in one operation, and raw SQL is not available here: the app's
     client is the RLS proxy, which exposes model operations only — `$executeRaw` is not a function
     on it, and that restriction is exactly what makes tenant isolation a database guarantee rather
     than a convention. Found by clicking a notification, not by any test. Losing a race on this
     trim costs at most one already-seen line showing bold again. */
  const row = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { notificationsReadKeys: true },
  });
  if (row && row.notificationsReadKeys.length > MAX_READ_KEYS) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { notificationsReadKeys: pruneReadKeys(row.notificationsReadKeys) },
    });
  }
}

/**
 * Everything read.
 *
 * ⚠️ Clearing the individual keys as well is what keeps the column bounded: the marker now covers
 * every one of them, so keeping the list would store the same fact twice and only one copy is
 * capped.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  /* ⚠️ The marker is `clearedAtFor`, not `new Date()`. An event stamped even slightly ahead of this
     server's clock — database and app are different machines — is newer than "now", so it would stay
     unread, the badge would never reach zero, and pressing the button again would do nothing. The
     later of now and the newest visible event is also the more honest claim: everything in front of
     them has been read. */
  const feed = await getNotificationFeed();
  await prisma.user.update({
    where: { id: session.userId },
    data: { notificationsClearedAt: clearedAtFor(feed.events), notificationsReadKeys: [] },
  });
  revalidatePath("/", "layout");
}
