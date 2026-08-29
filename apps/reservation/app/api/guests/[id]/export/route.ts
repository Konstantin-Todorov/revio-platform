import { NextResponse, type NextRequest } from "next/server";
import { buildGuestExport, exportFilename } from "@revio/core";
import { getSession } from "@/lib/session";
import { getProperty } from "@/lib/data";
import { prisma } from "@/lib/db";

/**
 * Everything held about one guest, as JSON — GDPR Art. 15 (access) and Art. 20 (portability).
 *
 * The DPA already promised a hotel could do this. It could not.
 *
 * JSON rather than the CSV the reports use: Art. 20 asks for "structured, commonly used and
 * machine-readable", and a stay history is nested — flattening it to CSV loses the shape or
 * duplicates the person across every row.
 *
 * ## Scoped twice, on purpose
 *
 * Through `getProperty()` (the session's active property) **and** in the `where` clause. A route that
 * takes an id from the URL and returns personal data is the shape most likely to leak across tenants,
 * and RLS is the third layer under both. Cheap here; expensive to discover later.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const property = await getProperty();

  const guest = await prisma.guest.findFirst({
    where: { id, propertyId: property.id },
    include: {
      reservations: {
        include: {
          lines: { select: { checkIn: true, checkOut: true } },
          bookingSource: { select: { name: true } },
          channel: { select: { name: true } },
        },
        orderBy: { importedAt: "desc" },
      },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!guest) return NextResponse.json({ error: "not found" }, { status: 404 });

  /*
   * Invoices are found through the guest's RESERVATIONS rather than a guest link, because a tax
   * document belongs to the stay, not to the person. They are listed and never erased — the subject
   * is entitled to know one exists, and Art. 17(3)(b) is why it stays.
   */
  const invoices = guest.reservations.length
    ? await prisma.taxInvoice.findMany({
        where: { propertyId: property.id, reservationId: { in: guest.reservations.map((r) => r.id) } },
        select: { number: true, issueDate: true, grossMinor: true, currency: true },
        orderBy: { issueDate: "asc" },
      })
    : [];

  const payload = buildGuestExport({
    guest: {
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      emailIsOtaAlias: guest.emailIsOtaAlias,
      phone: guest.phone,
      company: guest.company,
      specialRequests: guest.specialRequests,
      createdAt: guest.createdAt,
      recognitionOptOut: guest.recognitionOptOut,
      erasedAt: guest.erasedAt,
    },
    reservations: guest.reservations.map((r) => {
      const nights = r.lines.map((l) => l.checkIn).sort();
      const outs = r.lines.map((l) => l.checkOut).sort();
      return {
        reference: r.externalId ?? r.id.slice(-6).toUpperCase(),
        status: r.status,
        checkIn: nights[0]?.toISOString().slice(0, 10) ?? null,
        checkOut: outs[outs.length - 1]?.toISOString().slice(0, 10) ?? null,
        source: r.bookingSource?.name ?? r.channel?.name ?? null,
        totalMinor: r.totalMinor,
        currency: r.currency,
        notes: r.notes,
      };
    }),
    notes: guest.notes.map((n) => ({
      // `authorName` is denormalised on the note, so a staff member leaving does not erase who
      // wrote it — and the export stays truthful about provenance.
      author: n.authorName,
      body: n.body,
      createdAt: n.createdAt,
    })),
    invoices: invoices.map((i) => ({
      number: i.number,
      issuedAt: i.issueDate,
      grossMinor: i.grossMinor,
      currency: i.currency,
    })),
    propertyName: property.name,
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(guest)}"`,
      // Never cached anywhere. This is one person's complete personal record.
      "cache-control": "no-store, private",
    },
  });
}
