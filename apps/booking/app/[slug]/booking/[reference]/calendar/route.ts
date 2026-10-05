import { stayIcs } from "@revio/core";
import { bookingReference } from "@revio/booking";
import { getPublicProperty } from "@/lib/property";
import { findByReference } from "@/lib/manage";

/**
 * The stay as an .ics file — Apple Calendar, Outlook and everything else that is not Google. Same
 * reach as the confirmation page itself (by reference), and it says nothing that page does not.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;
  const property = await getPublicProperty(slug);
  if (!property) return new Response("Not found", { status: 404 });
  const r = await findByReference(property, reference);
  const line = r?.lines[0];
  if (!r || !line || r.status === "cancelled") return new Response("Not found", { status: 404 });
  const ref = bookingReference(r.id);
  const ics = stayIcs({
    uid: `${ref}@reviosoft.app`,
    title: property.name,
    checkIn: line.checkIn.toISOString().slice(0, 10),
    checkOut: line.checkOut.toISOString().slice(0, 10),
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    timezone: property.timezone,
    location: property.address,
    description: `${ref} · ${line.roomType?.name ?? ""}${property.phone ? ` · ${property.phone}` : ""}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ref}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
