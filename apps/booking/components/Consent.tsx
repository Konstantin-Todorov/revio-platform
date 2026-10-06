"use client";

import { useEffect, useState } from "react";
import { loadTags, readConsent, revokeTags, writeConsent } from "@/lib/tags";

/**
 * Asks the guest before the hotel's Google Analytics / Meta pixel load — and renders nothing at all
 * when the hotel has set neither (the layout does not mount it then).
 *
 * Accept and Decline are the same size, side by side: under the ePrivacy rules a refusal that takes
 * more effort than consent is not a free choice. Nothing loads before Accept. The footer's "Cookie
 * settings" reopens this (a window event, so the server-rendered footer needs no client state).
 */
export function Consent({ slug, tags, s }: {
  slug: string;
  tags: { ga4Id: string | null; metaPixelId: string | null };
  s: { label: string; body: string; accept: string; decline: string };
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const v = readConsent(slug);
    if (v === "granted") loadTags(tags);
    else if (v == null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener("revio:consent-open", reopen);
    return () => window.removeEventListener("revio:consent-open", reopen);
  }, [slug, tags]);

  if (!open) return null;
  const choose = (v: "granted" | "denied") => {
    writeConsent(slug, v);
    if (v === "granted") loadTags(tags); else revokeTags();
    setOpen(false);
  };
  return (
    <div role="dialog" aria-label={s.label} aria-live="polite"
         className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[40rem] rounded-[var(--r-lg)] border p-4 shadow-lg sm:inset-x-6 sm:p-5"
         style={{ backgroundColor: "hsl(var(--surface))", borderColor: "hsl(var(--line-strong))", color: "hsl(var(--ink))" }}>
      <p className="text-[14px] font-semibold">{s.label}</p>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>{s.body}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => choose("denied")} className="btn btn-outline min-h-[44px] text-[14px]">{s.decline}</button>
        <button type="button" onClick={() => choose("granted")} className="btn btn-outline min-h-[44px] text-[14px]">{s.accept}</button>
      </div>
    </div>
  );
}

/** "Cookie settings" in the footer — reopens the banner. Shown only when there are tags to ask about. */
export function ConsentSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("revio:consent-open"))} className="link-quiet font-semibold">
      {label}
    </button>
  );
}

/** Mounted on a confirmed booking: one purchase event for the hotel's tags, with consent only. */
export function PurchaseEvent(props: { slug: string; tags: { ga4Id: string | null; metaPixelId: string | null }; reference: string; valueMinor: number; currency: string }) {
  useEffect(() => {
    void import("@/lib/tags").then(({ trackPurchase }) =>
      trackPurchase(props.slug, props.tags, { reference: props.reference, valueMinor: props.valueMinor, currency: props.currency }));
  }, [props.slug, props.tags, props.reference, props.valueMinor, props.currency]);
  return null;
}
