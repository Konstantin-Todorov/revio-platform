/**
 * Public booking-engine slugs — the `<slug>` in `book.revio.app/<slug>`.
 *
 * This string is the hotel's public address. It ends up in printed QR codes, Instagram bios and
 * email signatures, so it is generated once from the property name and then treated as permanent:
 * changing it silently breaks links the hotel has already handed out. Renaming is a deliberate
 * action with a warning, never a side effect of editing the property name.
 */

/** Reserved because they are (or will be) our own routes, or are confusable with them. */
const RESERVED = new Set([
  "api", "app", "admin", "assets", "book", "booking", "dashboard", "health", "help", "images",
  "internal", "login", "logout", "operator", "pms", "public", "revio", "static", "status",
  "support", "www",
]);

const MAX_LEN = 40;

/**
 * Turn a property name into a URL-safe slug. Transliterates Cyrillic first — a Bulgarian hotel
 * named "Хотел София" must not collapse to an empty string, which is exactly what a naive
 * `[^a-z0-9]` filter would do.
 */
export function slugifyPropertyName(name: string): string {
  const latin = transliterate(name.trim().toLowerCase());
  return latin
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: "café" → "cafe"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN)
    .replace(/-+$/, "");
}

/** Bulgarian Cyrillic → Latin, following the official streamlined system used for place names. */
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

function transliterate(s: string): string {
  let out = "";
  for (const ch of s) out += CYRILLIC[ch] ?? ch;
  return out;
}

/** Whether a slug is structurally usable as a public address (does not check uniqueness). */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > MAX_LEN) return false;
  if (RESERVED.has(slug)) return false;
  // Lowercase alphanumerics and single inner hyphens only — no leading/trailing/double hyphens.
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

export function slugRejectionReason(slug: string): string | null {
  if (slug.length < 3) return "Too short — use at least 3 characters.";
  if (slug.length > MAX_LEN) return `Too long — keep it under ${MAX_LEN} characters.`;
  if (RESERVED.has(slug)) return "That word is reserved. Pick something more specific to the hotel.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return "Use lowercase letters, numbers and single hyphens only.";
  }
  return null;
}

/**
 * A free slug for a property, given what is already taken. Falls back to a numeric suffix rather
 * than a random one so the result stays readable and guessable: `hotel-sofia-2`, not `hotel-sofia-x7f`.
 */
export function proposeSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugifyPropertyName(name) || "hotel";
  const seed = isValidSlug(base) ? base : `hotel-${base}`.slice(0, MAX_LEN);
  if (!taken.has(seed) && isValidSlug(seed)) return seed;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${seed.slice(0, MAX_LEN - String(n).length - 1)}-${n}`;
    if (!taken.has(candidate) && isValidSlug(candidate)) return candidate;
  }
  return `${seed.slice(0, 30)}-${Date.now().toString(36).slice(-4)}`;
}
