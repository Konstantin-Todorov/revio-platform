/**
 * The staff products in the hotel's own language — the rules every translated screen follows.
 *
 * ## The one guarantee: a missing translation can never break a screen
 *
 * A dictionary is `{ en: Strings, bg: DeepPartial<Strings> }`. `translate` lays Bulgarian over
 * English key by key, so a string nobody has translated yet shows in English — never blank, never
 * `undefined`, never a key name. That is what lets the products move to Bulgarian one screen at a
 * time with every intermediate state shippable. `translationCoverage` reports what is left, and
 * `pnpm i18n:coverage` prints it per dictionary.
 *
 * ## Terminology is decided, not translated
 *
 * The marketing site fixed it first (`revio-websites/src/i18n/ui.ts`) and the products follow it,
 * enforced by `scripts/terminology-lint.mjs`: **канален мениджър** (never the borrowing), **обект**
 * for property, **ценови план** for rate plan, **наличност** for availability, **хаускийпинг**,
 * **система за директни резервации** for booking engine. Formal **Вие** throughout. Product names
 * (RevioLink, RevioCRS, RevioPMS, RevioDirect) are marks and are never translated.
 *
 * ## What is deliberately not translated
 *
 * Legal documents (terms, DPA, invoices' legal wording) stay English until somebody qualified
 * translates them — the same line the marketing site draws. Data the hotel typed (room names,
 * guest names, notes) is shown as typed.
 *
 * ## Whose language
 *
 * The PERSON's — `User.locale`, so a housekeeper who picked Bulgarian gets it on her phone and in
 * every product the hotel runs. Before sign-in there is no person, so the `revio_locale` cookie (set
 * when they choose) decides, then English.
 */

export const LOCALES = ["en", "bg"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Set on the shared parent domain in production, so a choice made in one product holds in all. */
export const LOCALE_COOKIE = "revio_locale";

/** What a language picker shows — each language in its own words. */
export const LOCALE_LABELS: Record<Locale, { native: string; htmlLang: string; intl: string }> = {
  en: { native: "English", htmlLang: "en", intl: "en-GB" },
  // `lang="bg"` is not cosmetic: Source Sans 3 ("Revio Cyrillic") switches to Bulgarian letterforms
  // under it, and screen readers pick their voice by it.
  bg: { native: "Български", htmlLang: "bg", intl: "bg-BG" },
};

export function parseLocale(value: unknown): Locale | null {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value) ? (value as Locale) : null;
}

/** The first choice that is a real locale: the person's, then the cookie's, then English. */
export function resolveLocale(...choices: unknown[]): Locale {
  for (const c of choices) {
    const l = parseLocale(c);
    if (l) return l;
  }
  return DEFAULT_LOCALE;
}

type Leaf = string | ((...args: never[]) => string);
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends Leaf ? T[K] : DeepPartial<T[K]> };
export interface Translations<T> {
  en: T;
  bg: DeepPartial<T>;
}

function isBranch(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function overlay<T>(base: T, over: unknown): T {
  if (!isBranch(base) || !isBranch(over)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null || v === "") continue; // an empty string is "not translated", not "blank"
    const b = (base as Record<string, unknown>)[k];
    out[k] = isBranch(b) ? overlay(b, v) : v;
  }
  return out as T;
}

/** The strings for one locale — Bulgarian over English, key by key. English is never missing. */
export function translate<T>(dict: Translations<T>, locale: Locale): T {
  return locale === "en" ? dict.en : overlay(dict.en, dict.bg);
}

/** Which English keys have no Bulgarian yet. Paths are dotted, for a report a person can act on. */
export function translationCoverage<T>(dict: Translations<T>): { total: number; translated: number; missing: string[] } {
  const missing: string[] = [];
  let total = 0;
  const walk = (en: unknown, bg: unknown, path: string) => {
    if (isBranch(en)) {
      for (const [k, v] of Object.entries(en)) walk(v, isBranch(bg) ? bg[k] : undefined, path ? `${path}.${k}` : k);
      return;
    }
    // An English value that is deliberately empty (no placeholder, no suffix) has nothing to translate.
    if (en === "") return;
    total++;
    if (bg === undefined || bg === null || bg === "") missing.push(path);
  };
  walk(dict.en, dict.bg, "");
  return { total, translated: total - missing.length, missing };
}

/**
 * Fill a `{name}` template. For CLIENT components only.
 *
 * ⚠️ A server component can hand a client component strings, never functions — Next refuses to
 * serialise a function prop and the whole page fails. So a dictionary's `(room) => \`Room ${room}\``
 * is turned into "Room {room}" on the server (`template()`), and filled here in the browser. Anything
 * whose WORDING depends on a number (Bulgarian plural forms) is computed on the server instead.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** A dictionary function turned into a `{name}` template for `fill` — see its note. */
export function template<A extends string[]>(fn: (...args: A) => string, ...names: A): string {
  return fn(...(names.map((n) => `{${n}}`) as A));
}

/* ── Formatting ────────────────────────────────────────────────────────────────────────────────
 * Bulgarian writes 24.09.2026 г., 1 234,50 € and "сряда" — a date or a price formatted for English
 * inside a Bulgarian sentence reads as a bug. Always through these, never `toLocaleString()` bare.
 */

/** A calendar date (YYYY-MM-DD) — formatted as that DAY, never shifted through a time zone. */
export function formatDay(isoDate: string, locale: Locale, style: "short" | "long" = "short"): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE_LABELS[locale].intl, {
    timeZone: "UTC",
    ...(style === "long" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" }),
  }).format(d);
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_LABELS[locale].intl).format(n);
}

/** Money is integer minor units + an ISO currency, everywhere in Revio. */
export function formatMoney(minor: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_LABELS[locale].intl, { style: "currency", currency }).format(minor / 100);
}

/**
 * Bulgarian plural agreement is two-way for counts of things (1 стая, 2 стаи, 0 стаи). One helper so
 * a count is never glued to the wrong form — English has the same shape.
 */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
