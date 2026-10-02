import { forSystem } from "@revio/db";

/**
 * The tab icon for a hotel that has not uploaded a logo: the first letter of its name on its own
 * brand colour — a little square that belongs to THEM.
 *
 * The browser's blank globe read as "this page is not quite finished", which is the wrong thing to
 * suggest beside a card form. A Revio mark would be worse: the page is the hotel's, not ours.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const p = await forSystem().property.findUnique({
    where: { id: propertyId },
    select: { name: true, bookingBrandColor: true, emailBrandColor: true, bookingEngineEnabled: true },
  });
  if (!p || !p.bookingEngineEnabled) return new Response("Not found", { status: 404 });
  const color = /^#[0-9a-f]{6}$/i.test(p.bookingBrandColor ?? "") ? p.bookingBrandColor!
    : /^#[0-9a-f]{6}$/i.test(p.emailBrandColor ?? "") ? p.emailBrandColor! : "#1f2a44";
  // White or near-black letter, whichever reads on the colour (relative luminance).
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const ink = (1.05 / (lum(color) + 0.05)) >= 3 ? "#ffffff" : "#111827";
  const letter = (p.name.trim().replace(/^(hotel|хотел|guest house|къща за гости)\s+/i, "")[0] ?? "H").toUpperCase()
    .replace(/[<&>"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" fill="${ink}">${letter}</text></svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
  });
}
