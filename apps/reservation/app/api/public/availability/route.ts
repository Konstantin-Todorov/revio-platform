/**
 * Booking-engine seam: PUBLIC availability search (addendum §6.1). Unauthenticated by design —
 * gated by the BOOKING_ENGINE_API env flag (off ⇒ 503) until the widget ships. Read-only.
 *
 * GET /api/public/availability?propertyId=…&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=2
 */
import { NextResponse, type NextRequest } from "next/server";
import { forSystem, forTenant } from "@revio/db";
import { publicAvailability } from "@/lib/public-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.BOOKING_ENGINE_API !== "on") {
    return NextResponse.json({ error: "The booking-engine API is not enabled." }, { status: 503 });
  }
  const sp = req.nextUrl.searchParams;
  const propertyId = sp.get("propertyId") ?? "";
  const property = propertyId ? await forSystem().property.findUnique({ where: { id: propertyId } }) : null;
  if (!property || property.status !== "active") {
    return NextResponse.json({ error: "Unknown property." }, { status: 404 });
  }

  const db = forTenant(property.tenantId);
  const result = await publicAvailability(db, property, {
    checkIn: sp.get("checkIn") ?? "",
    checkOut: sp.get("checkOut") ?? "",
    guests: Number(sp.get("guests") ?? "2"),
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    property: { id: property.id, name: property.name, currency: property.baseCurrency },
    checkIn: sp.get("checkIn"), checkOut: sp.get("checkOut"), guests: Number(sp.get("guests") ?? "2"),
    options: result.options,
  });
}
