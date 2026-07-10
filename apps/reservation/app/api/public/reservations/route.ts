/**
 * Booking-engine seam: PUBLIC reservation create (addendum §6.1). Writes the ONE shared-core
 * reservation record, tagged source = Booking Engine (category "direct"). Gated by the
 * BOOKING_ENGINE_API env flag (off ⇒ 503) until the widget ships.
 *
 * POST /api/public/reservations
 * { propertyId, roomTypeId, ratePlanId, checkIn, checkOut, guests, guest: { firstName, lastName, email, phone? } }
 */
import { NextResponse, type NextRequest } from "next/server";
import { forSystem, forTenant } from "@revio/db";
import { publicCreateReservation, type PublicBookingPayload } from "@/lib/public-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.BOOKING_ENGINE_API !== "on") {
    return NextResponse.json({ error: "The booking-engine API is not enabled." }, { status: 503 });
  }
  let body: (PublicBookingPayload & { propertyId?: string }) | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const property = body?.propertyId ? await forSystem().property.findUnique({ where: { id: body.propertyId } }) : null;
  if (!property || property.status !== "active") {
    return NextResponse.json({ error: "Unknown property." }, { status: 404 });
  }

  const db = forTenant(property.tenantId);
  const result = await publicCreateReservation(db, property, body!);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
