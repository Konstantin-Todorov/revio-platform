import { EMAIL_LOCALES, type EmailLocale } from "../email/templates.js";

/**
 * Which language a guest reads the booking page in.
 *
 * The order is the one the good engines use, for reasons:
 *
 * 1. **What the guest picked** (the switcher's cookie). A choice made on purpose outranks anything
 *    we infer.
 * 2. **What their browser asks for**, in its own order of preference — the whole `Accept-Language`
 *    list, not its first entry. A German traveller's browser usually says `de, en;q=0.8`; we have no
 *    German, and reading only the first entry would have sent them to the hotel's default. The second
 *    choice they made — English — is the one they would pick themselves.
 * 3. **The hotel's own default** — for a guest whose browser names nothing we speak.
 *
 * Only languages we actually send in (`EMAIL_LOCALES`) can come out, because the confirmation email
 * follows the page and a page in a language the email cannot speak would break mid-booking.
 */
export function negotiateGuestLanguage(input: {
  chosen?: string | null | undefined;
  acceptLanguage?: string | null | undefined;
  fallback?: string | null | undefined;
}): EmailLocale {
  const known = new Set<string>(EMAIL_LOCALES.map((l) => l.key));
  const base = (tag: string) => tag.trim().toLowerCase().split("-")[0]!;

  if (input.chosen && known.has(base(input.chosen))) return base(input.chosen) as EmailLocale;

  if (input.acceptLanguage) {
    const ranked = input.acceptLanguage
      .split(",")
      .map((part, i) => {
        const [tag, ...params] = part.split(";");
        const q = params.map((x) => x.trim()).find((x) => x.startsWith("q="));
        const weight = q ? Number(q.slice(2)) : 1;
        return { tag: base(tag ?? ""), weight: Number.isFinite(weight) ? weight : 0, i };
      })
      .filter((x) => x.tag && x.weight > 0)
      // Highest weight first; equal weights keep the browser's own order.
      .sort((a, b) => b.weight - a.weight || a.i - b.i);
    const hit = ranked.find((x) => known.has(x.tag));
    if (hit) return hit.tag as EmailLocale;
  }

  if (input.fallback && known.has(base(input.fallback))) return base(input.fallback) as EmailLocale;
  return "en";
}
