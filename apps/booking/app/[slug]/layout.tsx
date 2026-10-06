import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bookingPreset, needsConsent } from "@revio/core";
import { Consent } from "@/components/Consent";
import { getPublicProperty } from "@/lib/property";
import { brandTokens, fontVars } from "@/lib/brand";
import { LocaleProvider } from "@revio/ui/i18n-context";
import { guestLocale, serverKit } from "@/lib/i18n/server";

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
  const { s } = await serverKit(property);
  return {
    title: s.meta.title(property.name),
    description: s.meta.description(property.name),
    robots: { index: false, follow: false },
    /*
     * The HOTEL's logo in the tab — never Revio's.
     *
     * The other four apps each ship a Revio mark as `app/icon.png`; this one deliberately does not,
     * because the whole claim of a direct booking page is that it belongs to the hotel. A guest with
     * this tab open beside the hotel's own website should see the same little square in both.
     *
     * A hotel that has uploaded nothing gets its own initial on its own colour (the favicon route),
     * never ours: a Revio tab on someone else's booking page would not be honest, and the browser's
     * blank globe beside a card form reads as an unfinished page.
     */
    icons: { icon: property.logoUrl ?? `/api/brand/${property.id}/favicon` },
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
  // The preset supplies only neutrals and shape; the accent is always the hotel's own colour. That
  // separation is what lets "pick a base, then edit" compose — the two choices cannot fight.
  const { tokens: p } = bookingPreset(property.preset);
  // The guest's language — their pick, their browser, or the hotel's default. Carried to client
  // components by the provider, and stated on the page for screen readers and the browser's own
  // translate prompt (the root <html> cannot know it: it is rendered before a slug resolves).
  const locale = await guestLocale(property.defaultLanguage);
  // The hotel's own tags, and the question they require — absent entirely when it has none.
  const { s } = await serverKit(property);
  const tools = [property.tags.ga4Id && "Google Analytics", property.tags.metaPixelId && "Meta pixel"].filter(Boolean).join(locale === "bg" ? " и " : " and ");

  return (
    <LocaleProvider locale={locale}>
    <div
      lang={locale}
      /* Paints the ground itself: <body> resolved --ground from :root before this subtree existed,
         so a preset that only overrides the variable would leave the page behind it unchanged. */
      className="relative min-h-screen bg-[hsl(var(--ground))]"
      style={
        {
          "--ground": p.ground,
          "--surface": p.surface,
          "--surface-sunk": p.surfaceSunk,
          "--ink": p.ink,
          "--ink-soft": p.inkSoft,
          "--ink-faint": p.inkFaint,
          "--line": p.line,
          "--line-strong": p.lineStrong,
          "--r": `${p.radius}px`,
          "--r-sm": `${Math.max(6, p.radius - 4)}px`,
          "--r-lg": `${p.radius + 6}px`,
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
      {needsConsent(property.tags) && (
        <Consent slug={property.slug} tags={property.tags}
                 s={{ label: s.consent.label, body: s.consent.body(property.name, tools), accept: s.consent.accept, decline: s.consent.decline }} />
      )}
    </div>
    </LocaleProvider>
  );
}
