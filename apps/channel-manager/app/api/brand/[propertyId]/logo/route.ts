import { NextResponse } from "next/server";
import { forSystem } from "@revio/db";

/**
 * Serves a hotel's uploaded email logo.
 *
 * PUBLIC BY DESIGN, and it has to be. An email logo is fetched by Gmail's image proxy, Outlook, and
 * every other client — none of which carry the guest's or the hotel's session. A `data:` URI would
 * avoid the round trip but most clients strip those, so a plain public HTTPS URL is the only thing
 * that reliably renders. The exposure is a hotel's own logo, which it puts on its website anyway.
 *
 * The system perimeter is used deliberately: there is no tenant context on an unauthenticated
 * request, and the response is scoped to exactly one asset row looked up by property id.
 */
export const dynamic = "force-dynamic";

const prisma = forSystem();

export async function GET(_req: Request, ctx: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await ctx.params;

  const asset = await prisma.brandAsset.findUnique({
    where: { propertyId_kind: { propertyId, kind: "email_logo" } },
    select: { bytes: true, mimeType: true, updatedAt: true },
  });
  if (!asset) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.bytes.length),
      // The URL carries a ?v= that changes on every upload, so the bytes at a given URL are
      // immutable and can be cached hard — which matters when a mail client re-fetches per open.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": asset.updatedAt.toUTCString(),
      // The bytes are attacker-influenced (an upload), so forbid sniffing them into script.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; sandbox",
    },
  });
}
