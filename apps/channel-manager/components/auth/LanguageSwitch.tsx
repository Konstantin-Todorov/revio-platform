import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@revio/ui/i18n";
import { setLocale } from "@/lib/actions-locale";

/**
 * The language choice on the sign-in screens, where there is no person yet to remember it for — the
 * cookie does, and the first sign-in carries it into their account.
 *
 * Each language named in its own words and both always visible, as in the account menu: somebody
 * who cannot read the current one can still find the one they can.
 */
export function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLocale} aria-label={label} className="flex items-center gap-1">
      <Languages className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="submit"
          name="locale"
          value={l}
          lang={LOCALE_LABELS[l].htmlLang}
          aria-pressed={l === locale}
          className={`rounded px-2 py-0.5 text-[12.5px] font-semibold transition-colors ${
            l === locale ? "bg-brand-50 text-brand-800" : "text-ink-500 hover:bg-white hover:text-ink-800"
          }`}
        >
          {LOCALE_LABELS[l].native}
        </button>
      ))}
    </form>
  );
}
