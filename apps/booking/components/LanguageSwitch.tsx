"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { EMAIL_LOCALES } from "@revio/core";
import { GUEST_LANG_COOKIE } from "@/lib/i18n/kit";
import { useGuestKit } from "@/lib/i18n/use-kit";

/**
 * The guest's language, one tap away in the header — where every booking site a traveller has used
 * puts it.
 *
 * A native <select>: it is the control that scales from two languages to ten without a redesign,
 * and on a phone it opens the system picker, which is larger and more familiar than anything we
 * would draw. Each language is written in itself ("Български", not "Bulgarian") — the person looking
 * for their language may not read the one the page is currently in.
 *
 * The choice is a cookie, read on the server, so the page re-renders in the new language with
 * nothing lost: the dates, the guests and the held room are all in the URL, and the refresh keeps it.
 */
export function LanguageSwitch() {
  const { locale, s } = useGuestKit();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <label className="relative flex items-center" style={{ opacity: pending ? 0.6 : 1 }}>
      <span className="sr-only">{s.header.language}</span>
      <Globe size={14} aria-hidden className="pointer-events-none absolute left-2.5" style={{ color: "hsl(var(--ink-soft))" }} />
      <select
        value={locale}
        onChange={(e) => {
          document.cookie = `${GUEST_LANG_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          start(() => router.refresh());
        }}
        className="min-h-[38px] cursor-pointer appearance-none rounded-[var(--r-sm)] border bg-transparent py-1 pl-7 pr-2.5 text-[13px] font-semibold outline-none"
        style={{ borderColor: "hsl(var(--line-strong))", color: "hsl(var(--ink))" }}
      >
        {EMAIL_LOCALES.map((l) => (
          <option key={l.key} value={l.key}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
