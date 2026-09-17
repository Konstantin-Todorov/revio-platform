"use client";

import { useEffect, useRef } from "react";

/**
 * The Turnstile widget, as a form field.
 *
 * It writes a token into a hidden input named `cf-turnstile-response`, which is the name Cloudflare's
 * own docs use and the name the server action reads. Nothing else about the form changes.
 *
 * ## Renders nothing without a site key
 *
 * The code ships before the keys exist — that is the only order that works — so an absent key must
 * be a no-op rather than a broken form. The server side is permissive to match: see
 * `turnstileNotConfigured`.
 *
 * ## Why the script is loaded here rather than in the layout
 *
 * One page in the platform needs it. A `<Script>` in the root layout would put a third-party request
 * on every screen a hotel opens all day, including the front desk, to protect one form.
 *
 * ⚠️ The callback is reached through a named global, not a React closure. Cloudflare's script calls
 * it by string name from outside React, so a closure would capture the first render's props and a
 * re-render would silently stop updating the token.
 */
export function TurnstileField({ siteKey }: { siteKey?: string | undefined }) {
  const holder = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    const el = holder.current;
    const field = input.current;

    // A unique global per mount: two widgets on one page must not fight over one callback name.
    const cbName = `__revioTurnstile_${Math.random().toString(36).slice(2)}`;
    const w = window as unknown as Record<string, unknown>;
    w[cbName] = (token: string) => {
      if (field) field.value = token;
    };

    const script = document.createElement("script");
    script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const turnstile = (window as unknown as { turnstile?: { render: (e: HTMLElement, o: unknown) => void } }).turnstile;
      // The script can load and the global still be absent — a blocked or trimmed response. Do
      // nothing rather than throw inside an effect on the signup page.
      turnstile?.render(el, { sitekey: siteKey, callback: cbName, theme: "light" });
    };
    document.head.appendChild(script);

    return () => {
      delete w[cbName];
      script.remove();
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div className="mt-1">
      <div ref={holder} />
      {/* Cloudflare's own field name. Empty until the challenge resolves; the server treats an empty
          token as "not verified" rather than as a failure — see readTurnstileResult. */}
      <input ref={input} type="hidden" name="cf-turnstile-response" defaultValue="" />
    </div>
  );
}
