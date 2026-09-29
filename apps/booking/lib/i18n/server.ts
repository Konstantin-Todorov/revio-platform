import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { negotiateGuestLanguage } from "@revio/core";
import type { Locale } from "@revio/ui/i18n";
import { GUEST_LANG_COOKIE, guestKit } from "./kit";

/**
 * The guest's language for this request: their own pick (the switcher's cookie), else what their
 * browser asks for, else the hotel's default. See `negotiateGuestLanguage` for why in that order.
 * Cached per request, so every component on a page agrees.
 */
export const guestLocale = cache(async (hotelDefault: string): Promise<Locale> =>
  negotiateGuestLanguage({
    chosen: (await cookies()).get(GUEST_LANG_COOKIE)?.value ?? null,
    acceptLanguage: (await headers()).get("accept-language"),
    fallback: hotelDefault,
  }) as Locale,
);

export async function serverKit(property: { defaultLanguage: string }) {
  return guestKit(await guestLocale(property.defaultLanguage));
}
