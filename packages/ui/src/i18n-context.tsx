"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "./i18n";

/**
 * The viewer's language, for client components.
 *
 * Only the LOCALE travels through context. Strings do not: a server component resolves its own
 * dictionary with `translate()` and passes the result down as props, so a client bundle never
 * carries the other language's text and a missing provider can only ever mean English.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
