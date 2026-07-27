import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProperty } from "@/lib/property";
import { brandTokens, fontVars } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * The hotel's own page — its name in the tab, its colour on the page, its logo at the top.
 *
 * Everything visual is derived from settings the hotel already filled in for its guest emails, so
 * turning the booking engine on requires no second round of branding work.
 */

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) return { title: "Not found" };
  return {
    title: `Book ${property.name}`,
    description: `Book direct at ${property.name}. Best rate, no booking fees.`,
    robots: { index: false, follow: false },
  };
}

export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await getPublicProperty(slug);
  if (!property) notFound();

  const tokens = brandTokens(property.brandColor);
  const fonts = fontVars(property.font);

  return (
    <div
      className="relative"
      style={
        {
          "--brand": tokens.brand,
          "--brand-ink": tokens.brandInk,
          "--brand-text": tokens.brandText,
          "--brand-wash": tokens.brandWash,
          "--brand-soft": tokens.brandSoft,
          "--font-display": fonts.display,
          "--font-body": fonts.body,
          "--display-weight": fonts.displayWeight,
          "--display-tracking": fonts.displayTracking,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
