"use client";

/**
 * The hotel's Google Analytics 4 and Meta pixel, loaded in the guest's browser ONLY after consent.
 *
 * One small module rather than a tag manager: two tags, both the hotel's, both gated on one yes.
 * Everything here is idempotent — the banner and the confirmation page may both ask for the tags,
 * and a guest who accepts twice must not get two pixels.
 */
type Tags = { ga4Id: string | null; metaPixelId: string | null };
type Consent = "granted" | "denied";

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...a: unknown[]) => void; push?: unknown }; _fbq?: unknown }
}

const key = (slug: string) => `revio-consent:${slug}`;

export function readConsent(slug: string): Consent | null {
  try {
    const v = localStorage.getItem(key(slug));
    return v === "granted" || v === "denied" ? v : null;
  } catch { return null; }
}

export function writeConsent(slug: string, v: Consent): void {
  try { localStorage.setItem(key(slug), v); } catch { /* private window: asked again next visit */ }
}

function addScript(src: string): void {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const el = document.createElement("script");
  el.async = true;
  el.src = src;
  document.head.appendChild(el);
}

/** Load the tags. Call only after consent; safe to call more than once. */
export function loadTags(tags: Tags): void {
  if (tags.ga4Id && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    // `arguments`, not rest parameters: gtag.js reads Arguments objects off the dataLayer and silently
    // ignores plain arrays — Google's own snippet is written this way for that reason.
    // eslint-disable-next-line prefer-rest-params
    window.gtag = function gtag() { window.dataLayer!.push(arguments); };
    window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", tags.ga4Id);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tags.ga4Id)}`);
  }
  if (tags.metaPixelId && !window.fbq) {
    // Meta's own loader stub, unrolled: queue calls until fbevents.js arrives.
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue!.push(args);
    } as NonNullable<Window["fbq"]>;
    fbq.queue = []; fbq.loaded = true; fbq.version = "2.0"; fbq.push = fbq;
    window.fbq = fbq; window._fbq = fbq;
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", tags.metaPixelId);
    window.fbq("track", "PageView");
  }
}

/** The guest said no after saying yes: tell the tags to stop. Nothing new loads on the next page. */
export function revokeTags(): void {
  window.gtag?.("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  window.fbq?.("consent", "revoke");
}

/**
 * One purchase per booking reference — never the guest's name, email or phone.
 * Fires only with consent; a reload of the confirmation page does not count the booking twice.
 */
export function trackPurchase(slug: string, tags: Tags, p: { reference: string; valueMinor: number; currency: string }): void {
  if (readConsent(slug) !== "granted") return;
  const once = `revio-purchase:${p.reference}`;
  try { if (localStorage.getItem(once)) return; localStorage.setItem(once, "1"); } catch { return; }
  loadTags(tags);
  const value = Math.round(p.valueMinor) / 100;
  window.gtag?.("event", "purchase", { transaction_id: p.reference, value, currency: p.currency });
  window.fbq?.("track", "Purchase", { value, currency: p.currency });
}
