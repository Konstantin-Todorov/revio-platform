import { cookies, headers } from "next/headers";
import { negotiateGuestLanguage } from "@revio/core";
import type { Locale } from "@revio/ui/i18n";
import { GUEST_LANG_COOKIE, guestKit } from "@/lib/i18n/kit";

/**
 * One page for every "you can't book here" case — wrong slug, engine switched off, suspended
 * account. Deliberately indistinguishable: telling a visitor which hotels are Revio customers, or
 * which have stopped paying, is not ours to disclose.
 *
 * No hotel is known here, so the language is the guest's pick or their browser's, else English.
 */
export default async function NotFound() {
  const locale = negotiateGuestLanguage({
    chosen: (await cookies()).get(GUEST_LANG_COOKIE)?.value ?? null,
    acceptLanguage: (await headers()).get("accept-language"),
  }) as Locale;
  const s = guestKit(locale).s.page;
  return (
    <main lang={locale} className="mx-auto flex min-h-screen max-w-[34rem] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">{s.eyebrow}</p>
      <h1 className="display mt-3 text-[2rem]">{s.unavailableTitle}</h1>
      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "hsl(var(--ink-soft))" }}>
        {s.unavailableBody}
      </p>
    </main>
  );
}
