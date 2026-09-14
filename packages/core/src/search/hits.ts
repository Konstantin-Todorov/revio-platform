/**
 * What a global search result is, and which one comes first.
 *
 * ## Why this is pure, and here
 *
 * Four products each grew their own `/search` page and each ranks by whatever order the database
 * returned. That is fine for a page of results somebody reads; it is not fine for a palette, where
 * **the first row is the answer** — people press Enter on it without looking. Ordering that changes
 * with the query planner is the difference between a tool and a lottery.
 *
 * So the ranking is one tested function, shared by all four. What each product *searches* stays
 * its own business — a room type means something different in RevioPMS than in RevioLink — but what
 * "best match" means does not.
 */

/** The kinds any product can return. The palette groups by these, in this order. */
export type HitKind =
  /** A customer of OURS — a tenant. Operator console only; a hotel never searches for itself. */
  | "client"
  | "hotel"
  | "reservation"
  | "guest"
  /** A named human who is not a guest: an owner, a staff account. Operator console only. */
  | "person"
  | "room"
  | "unit"
  | "rate"
  | "channel"
  | "invoice"
  | "page";

/** Group order on screen. A guest waiting at a desk outranks a rate plan, every time. */
const KIND_RANK: Record<HitKind, number> = {
  /* ⚠️ One order, shared by four products, and it works because the kinds barely overlap: only an
     operator ever sees `client` or `person`, only a hotel ever sees `reservation` or `unit`. What
     each product gets is its own slice of this list in this order, which is why a single rank can
     put a client first for us and a reservation first for a hotel without either disagreeing. */
  client: 0,
  reservation: 1,
  guest: 2,
  hotel: 3,
  person: 4,
  room: 5,
  unit: 6,
  rate: 7,
  channel: 8,
  invoice: 9,
  page: 10,
};

export const KIND_LABEL: Record<HitKind, string> = {
  client: "Clients",
  hotel: "Hotels",
  reservation: "Reservations",
  guest: "Guests",
  person: "People",
  room: "Room types",
  unit: "Rooms",
  rate: "Rate plans",
  channel: "Channels",
  invoice: "Invoices",
  page: "Go to",
};

export interface SearchHit {
  id: string;
  kind: HitKind;
  /** What the person was looking for — a name, a code, a reference. */
  title: string;
  /** One line of "which one is this". */
  subtitle?: string;
  href: string;
  /**
   * ⚠️ Which property this belongs to, when the account can open more than one.
   *
   * The founder's decision: search reaches every property the account holds, not only the active
   * one — "if the thing is in another property you do not find it and you do not understand why".
   * That only works if every row says which property it is from, because otherwise two identically
   * named rooms are indistinguishable and opening the wrong one is silent.
   */
  context?: string;
  /**
   * ⚠️ Which property this record actually lives in — so the click can land somewhere that works.
   *
   * Search reaches every property the account holds, but every screen it links to is scoped to the
   * ACTIVE one. Without this, a hit from a sister hotel led to "We couldn't find that" on a detail
   * screen and to an empty list everywhere else: the next screen denying what the search had just
   * proved exists. Reported from production on 2026-09-14.
   *
   * Set it on any hit whose destination is property-scoped, and leave it off for a hit that is not
   * (a page, a hotel itself). The row already carries `context` — the hotel's NAME — so somebody
   * clicking it can see where they are about to go; this is what makes going there work.
   */
  propertyId?: string;
}

/**
 * How well a hit matches, 0–100. Higher is better; 0 means it should not be shown.
 *
 * Three tiers, and the gaps between them are deliberately wide so no combination of tie-breakers
 * can reorder them:
 *
 * - **100** the whole field is the query — you typed the booking reference
 * - **70+** a word starts with the query — "Del" finds "Deluxe Double"
 * - **40+** it appears somewhere — "lux" finds "Deluxe"
 *
 * Within a tier, a shorter field wins: "BAR" beats "BAR Non-Refundable Winter" for the query "BAR",
 * because the shorter one is more likely to be the thing itself rather than something named after it.
 */
export function matchScore(field: string, query: string): number {
  const f = field.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q || !f) return 0;
  if (!f.includes(q)) return 0;

  const brevity = Math.max(0, 20 - Math.floor(f.length / 4));
  if (f === q) return 100;
  // A word boundary, not just position 0 — "Double" should be found inside "Deluxe Double".
  if (new RegExp(`(^|[\\s\\-–—/·,.])${escapeRe(q)}`).test(f)) return 70 + brevity;
  return 40 + brevity;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The best score across a hit's searchable fields. */
export function scoreHit(hit: SearchHit, query: string): number {
  return Math.max(
    matchScore(hit.title, query),
    // A subtitle match is real but weaker — it is context, not identity.
    Math.round(matchScore(hit.subtitle ?? "", query) * 0.6),
  );
}

/**
 * Rank and cap. Group order first, score second, title third.
 *
 * ⚠️ Sorting by score alone looks smarter and reads worse: it interleaves guests with rate plans, so
 * the list reshuffles its *shape* on every keystroke and the eye can never settle. Grouping first
 * keeps the shape stable while the contents change, which is what makes a palette feel fast rather
 * than frantic.
 */
export function rankHits(hits: readonly SearchHit[], query: string, limit = 12): SearchHit[] {
  return hits
    .map((h) => ({ h, s: scoreHit(h, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) =>
      KIND_RANK[a.h.kind] - KIND_RANK[b.h.kind] ||
      b.s - a.s ||
      a.h.title.localeCompare(b.h.title))
    .slice(0, limit)
    .map((x) => x.h);
}

export interface HitGroup {
  kind: HitKind;
  label: string;
  hits: SearchHit[];
}

/** Ranked hits, split into the headed groups the palette draws. Order is preserved. */
export function groupHits(hits: readonly SearchHit[]): HitGroup[] {
  const out: HitGroup[] = [];
  for (const h of hits) {
    const last = out[out.length - 1];
    if (last && last.kind === h.kind) last.hits.push(h);
    else out.push({ kind: h.kind, label: KIND_LABEL[h.kind], hits: [h] });
  }
  return out;
}

/**
 * ⌘ on a Mac, Ctrl everywhere else.
 *
 * Small, and it is exactly the kind of small that tells somebody nobody checked. Takes the platform
 * string rather than reading `navigator`, so it is testable and so the server never guesses.
 */
export function shortcutLabel(platform: string): string {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘K" : "Ctrl K";
}

/**
 * Is this query worth asking the database about?
 *
 * One character matches most of a hotel and returns noise at the cost of a query per keystroke.
 * Two is where a search starts being a search.
 */
export function isSearchable(query: string): boolean {
  return query.trim().length >= 2;
}
