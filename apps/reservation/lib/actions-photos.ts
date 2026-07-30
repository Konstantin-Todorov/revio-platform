"use server";

import { revalidatePath } from "next/cache";
import { getObjectStore, photoToken, roomPhotoKey } from "@revio/storage";
import { prisma } from "./db";
import { getProperty } from "./data";
import { logAudit, str } from "./mutation-helpers";
import { ImageRejected, processRoomPhoto } from "./images";

/**
 * Room photographs.
 *
 * Every action re-reads the room type through the tenant-scoped client before touching anything, so
 * a forged roomTypeId in a form post resolves to nothing rather than to another hotel's room. That
 * check is not optional here: unlike most screens, the ids on this one end up in object keys, and a
 * key that mixed two tenants would be visible from the outside.
 */

export interface PhotoResult {
  ok: boolean;
  error?: string;
  uploaded?: number;
}

/** How many photos one room type may hold. Beyond this a gallery stops being browsed. */
const MAX_PER_ROOM_TYPE = 12;

/**
 * Per-file ceiling, comfortably above a phone photo and well below the action body limit set in
 * `next.config.mjs`. Checked here so an oversized file gets a sentence naming the file and its size,
 * rather than Next rejecting the whole request with a 413 and the screen showing a generic crash.
 */
const MAX_FILE_BYTES = 15 * 1024 * 1024;

async function ownedRoomType(roomTypeId: string) {
  const property = await getProperty();
  if (!roomTypeId) return null;
  const roomType = await prisma.roomType.findFirst({
    where: { id: roomTypeId, propertyId: property.id },
    select: { id: true, name: true },
  });
  return roomType ? { property, roomType } : null;
}

export async function uploadRoomPhotos(_prev: PhotoResult | null, fd: FormData): Promise<PhotoResult> {
  const owned = await ownedRoomType(str(fd, "roomTypeId"));
  if (!owned) return { ok: false, error: "That room type no longer exists." };
  const { property, roomType } = owned;

  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Choose at least one image." };

  const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
  if (tooBig) {
    const mb = (tooBig.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `“${tooBig.name}” is ${mb} MB — the limit is 15 MB per photo. Most phone photos are well under it.`,
    };
  }

  const existing = await prisma.roomTypePhoto.count({ where: { roomTypeId: roomType.id } });
  if (existing + files.length > MAX_PER_ROOM_TYPE) {
    return {
      ok: false,
      error: `That would be ${existing + files.length} photos. ${MAX_PER_ROOM_TYPE} is the limit for one room type.`,
    };
  }

  const store = await getObjectStore();
  let sortOrder = existing;
  let uploaded = 0;

  for (const file of files) {
    let processed;
    try {
      processed = await processRoomPhoto(file);
    } catch (err) {
      if (err instanceof ImageRejected) {
        // Stop at the first bad file rather than silently skipping it — a hotel who picked six
        // photos and got five needs to know which one, and why.
        return { ok: false, ...(uploaded ? { uploaded } : {}), error: `${file.name}: ${err.message}` };
      }
      throw err;
    }

    const token = photoToken();
    const parts = { tenantId: property.tenantId, propertyId: property.id, roomTypeId: roomType.id, token };
    const fullKey = roomPhotoKey({ ...parts, variant: "full" });
    const thumbKey = roomPhotoKey({ ...parts, variant: "thumb" });

    // Objects first, row second. The reverse order can leave a row pointing at bytes that were
    // never written, which renders as a broken image on the guest's page; this order can at worst
    // leave unreferenced bytes in the bucket, which nobody sees.
    await store.put(fullKey, processed.full, { contentType: "image/webp" });
    await store.put(thumbKey, processed.thumb, { contentType: "image/webp" });

    await prisma.roomTypePhoto.create({
      data: {
        tenantId: property.tenantId,
        propertyId: property.id,
        roomTypeId: roomType.id,
        fullKey,
        thumbKey,
        width: processed.width,
        height: processed.height,
        byteSize: processed.full.byteLength,
        sortOrder: sortOrder++,
      },
    });
    uploaded++;
  }

  await logAudit(property.id, property.tenantId, {
    entity: `Room type · ${roomType.name}`,
    field: "photos",
    newValue: `${uploaded} added`,
  });
  revalidatePath("/rooms-rates");
  return { ok: true, uploaded };
}

export async function deleteRoomPhoto(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const photo = await prisma.roomTypePhoto.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true, fullKey: true, thumbKey: true, roomTypeId: true },
  });
  if (!photo) return;

  await prisma.roomTypePhoto.delete({ where: { id: photo.id } });

  // The row is the source of truth for what the page shows, so it goes first; a bucket object that
  // outlives its row is invisible waste, whereas a row without its object is a broken image.
  const store = await getObjectStore();
  await Promise.allSettled([store.delete(photo.fullKey), store.delete(photo.thumbKey)]);

  await logAudit(property.id, property.tenantId, {
    entity: "Room type photos", field: "delete", newValue: "removed",
  });
  revalidatePath("/rooms-rates");
}

/**
 * Reorder, which is also how a hotel chooses its cover shot — the first photo is the one on the
 * room card, so "make this the main picture" and "drag it first" are the same action rather than
 * two competing controls.
 */
export async function reorderRoomPhotos(fd: FormData): Promise<void> {
  const owned = await ownedRoomType(str(fd, "roomTypeId"));
  if (!owned) return;
  const { property, roomType } = owned;

  const ids = str(fd, "order").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;

  // Scope the update to this room type's own photos, so an id from another gallery is a no-op
  // rather than a cross-room reshuffle.
  const mine = await prisma.roomTypePhoto.findMany({
    where: { roomTypeId: roomType.id, propertyId: property.id },
    select: { id: true },
  });
  const allowed = new Set(mine.map((p) => p.id));

  let order = 0;
  for (const id of ids) {
    if (!allowed.has(id)) continue;
    await prisma.roomTypePhoto.update({ where: { id }, data: { sortOrder: order++ } });
  }

  revalidatePath("/rooms-rates");
}

/** Alt text — what a screen reader announces, and what shows if the image fails to load. */
export async function saveRoomPhotoAlt(fd: FormData): Promise<void> {
  const property = await getProperty();
  const id = str(fd, "id");
  const photo = await prisma.roomTypePhoto.findFirst({ where: { id, propertyId: property.id }, select: { id: true } });
  if (!photo) return;

  await prisma.roomTypePhoto.update({
    where: { id: photo.id },
    data: { alt: str(fd, "alt").trim().slice(0, 160) },
  });
  revalidatePath("/rooms-rates");
}
