/**
 * A provider's own mark, as the provider ships it — never redrawn (see `packages/ui/CLAUDE.md`,
 * "A brand mark is never re-drawn by eye"). Sources live in `design/brand/partners/`; the copies in
 * `public/integrations/` are only resized.
 *
 * Operator-only on purpose: the hotels never see Channex's name as a product they use (we are the
 * Channex customer, not them — root CLAUDE.md), and Stripe appears to a hotel only as the card field
 * Stripe renders itself.
 */
const LOGOS: Record<string, { src: string; alt: string }> = {
  stripe: { src: "/integrations/stripe.png", alt: "Stripe" },
  channex: { src: "/integrations/channex.png", alt: "Channex" },
};

export function hasProviderLogo(key: string): boolean {
  return key in LOGOS;
}

export function ProviderLogo({ provider, size = 36 }: { provider: string; size?: number }) {
  const logo = LOGOS[provider];
  if (!logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 96px static file; next/image buys nothing here
    <img src={logo.src} alt={logo.alt} width={size} height={size} className="shrink-0 rounded-md" style={{ width: size, height: size }} />
  );
}
