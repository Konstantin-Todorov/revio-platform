"use server";

import { headers } from "next/headers";
import { forTenant } from "@revio/db";
import { checkCalendar, clientIp, publicPriceCalendar } from "@revio/booking";
import { getPublicProperty } from "./property";

/**
 * The calendar's prices — the lowest all-in price per night for the months on screen.
 *
 * A server action rather than a route: the calendar is a client component on a page that already
 * resolved the property by slug, and this is one more read on the same perimeter. Rate-limited per
 * IP, because an anonymous caller turning this into a price scraper costs the hotel nothing but
 * costs us database time.
 *
 * Any "no" returns null and the calendar simply shows no prices — it is decoration on a control
 * that works without it, never a reason for the date picker to fail.
 */
export async function loadPriceCalendar(
  slug: string, from: string, to: string, guests: number,
): Promise<{ currency: string; days: Record<string, number | null> } | null> {
  const property = await getPublicProperty(slug);
  if (!property) return null;
  if (!checkCalendar(clientIp(await headers()), property.slug).ok) return null;
  try {
    return await publicPriceCalendar(forTenant(property.tenantId), { ...property, id: property.id }, { from, to, guests });
  } catch {
    return null;
  }
}
