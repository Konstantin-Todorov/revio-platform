/**
 * Turn a URL into the name of a *screen*.
 *
 * ## Why this has to be a pure, tested function
 *
 * Usage is stored one row per (hotel · product · screen · day). That is a tiny table — a few dozen
 * screens times a few hundred days — and it stays tiny only while a screen has one name. Store the
 * raw path and `/reservations/cmtr…` becomes a new row for every reservation anybody opens: the
 * table grows with the customer's business instead of with ours, and the question it exists to
 * answer ("which screens does a hotel actually use?") becomes unanswerable because every row has a
 * count of one.
 *
 * So identifiers collapse to `:id` and dates to `:date`, and the result is the screen the person was
 * on rather than the record they were looking at.
 *
 * ## It is also a privacy boundary
 *
 * A path can carry a guest's data — a search, an email address in a query string, a slug with a
 * person's name. Everything after `?` is dropped and every identifier is replaced, so what is stored
 * is "somebody opened the reservation detail screen" and never *which* reservation. That is the
 * whole of what we need to know which features earn their keep, and it means this table can never
 * become a record of one hotel's guests.
 */

/** A cuid as Prisma generates them: `c` + 24 lowercase alphanumerics. */
const CUID = /^c[a-z0-9]{20,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERIC = /^\d+$/;
/** A booking reference like `RV-07NR0F`, and our own `SR-2LBNMO`. */
const REFERENCE = /^[A-Z]{2}-[A-Z0-9]{5,10}$/;

function isIdentifier(segment: string): boolean {
  return (
    CUID.test(segment) ||
    UUID.test(segment) ||
    NUMERIC.test(segment) ||
    REFERENCE.test(segment) ||
    // A long opaque token with no vowel-ish shape is far more likely an id than a screen name. Kept
    // deliberately narrow: a real screen segment is a word somebody chose, and words are short.
    segment.length > 32
  );
}

export function normaliseRoute(path: string): string {
  // Everything after ? or # can carry a guest's own words. It never reaches storage.
  const withoutQuery = path.split(/[?#]/)[0] ?? "";
  const segments = withoutQuery.split("/").filter(Boolean);

  if (segments.length === 0) return "/";

  const named = segments.map((s) => {
    if (DATE.test(s)) return ":date";
    if (isIdentifier(s)) return ":id";
    return s;
  });

  return `/${named.join("/")}`;
}

/**
 * Screens that say nothing about what a hotel uses, and would drown the ones that do.
 *
 * Not recorded at all rather than filtered on the way out: a row nobody will ever read is still a
 * write on every page load, and the cheapest write is the one that does not happen.
 */
const IGNORED = new Set(["/logout", "/login", "/api", "/favicon.ico"]);

export function isRecordableRoute(route: string): boolean {
  if (!route.startsWith("/")) return false;
  if (IGNORED.has(route)) return false;
  // Anything under an ignored root — /login/2fa, /api/anything.
  return ![...IGNORED].some((i) => i !== "/" && route.startsWith(`${i}/`));
}
