import { HELP_ARTICLES, type HelpArticle } from "./articles.js";
import type { ProductKey } from "../products/products.js";

/**
 * Finding the right answer, without a search index.
 *
 * Sixteen articles do not need one, and a scoring function somebody can read beats a black box we
 * cannot explain when it puts the wrong answer first.
 *
 * ## The screen outranks the words
 *
 * The strongest signal is not what somebody typed — it is where they are standing. Somebody stuck on
 * `/mapping` who types "not showing" wants the mapping answer, and a keyword match elsewhere should
 * not beat it. `routeBoost` is therefore larger than any single word match, which is what lets "Get
 * help" offer useful answers **before** anybody types anything at all.
 */

export interface HelpQuery {
  /** What they typed. Empty is valid and means "what is relevant here?". */
  text?: string;
  /** Which product they are in. An answer that is wrong here is never shown. */
  product?: ProductKey;
  /** The screen they are on. */
  route?: string;
}

const ROUTE_BOOST = 100;
const QUESTION_HIT = 20;
const KEYWORD_HIT = 12;
const ANSWER_HIT = 4;

/** Words worth matching on. Two letters or fewer carry no signal and match everything. */
function terms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

function matchesRoute(article: HelpArticle, route: string): boolean {
  // Prefix match: `/settings/users` should hit an article about `/settings`.
  return (article.routes ?? []).some((r) => route === r || route.startsWith(`${r}/`));
}

export function scoreArticle(article: HelpArticle, q: HelpQuery): number {
  if (q.product && !article.products.includes(q.product)) return -1;

  let score = 0;
  if (q.route && matchesRoute(article, q.route)) score += ROUTE_BOOST;

  const words = terms(q.text ?? "");
  if (words.length > 0) {
    const question = article.question.toLowerCase();
    const answer = article.answer.toLowerCase();
    const keywords = (article.keywords ?? []).join(" ").toLowerCase();
    for (const w of words) {
      if (question.includes(w)) score += QUESTION_HIT;
      if (keywords.includes(w)) score += KEYWORD_HIT;
      else if (answer.includes(w)) score += ANSWER_HIT;
    }
    // Typed words that matched nothing at all: not an answer, whatever the screen says.
    if (score <= (q.route && matchesRoute(article, q.route) ? ROUTE_BOOST : 0)) return 0;
  }

  return score;
}

/**
 * The best answers for this person, right now.
 *
 * Returns `[]` rather than everything when a search matches nothing — a list of unrelated articles
 * after a specific question reads as "we did not understand you", which is worse than an honest
 * empty state offering to ask a human.
 */
export function searchHelp(q: HelpQuery, limit = 5): HelpArticle[] {
  return HELP_ARTICLES.map((a) => ({ a, s: scoreArticle(a, q) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.a.question.localeCompare(y.a.question))
    .slice(0, limit)
    .map((x) => x.a);
}

/** Everything that applies to one product, for the browse view. */
export function helpForProduct(product: ProductKey): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.products.includes(product));
}
