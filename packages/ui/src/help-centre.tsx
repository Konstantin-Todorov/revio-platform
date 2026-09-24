"use client";

import { useMemo, useState } from "react";
import {
  HELP_CATEGORIES,
  helpForProduct,
  searchHelp,
  type HelpCategory,
  type HelpArticle,
  type ProductKey,
} from "@revio/core";
import { fill, translate, type Locale } from "./i18n";
import { useLocale } from "./i18n-context";
import { helpStrings, type HelpStrings } from "./help-strings";

/** An article in the reader's language — core's English where there is no translation yet. */
function said(a: HelpArticle, t: HelpStrings): HelpArticle {
  const x = t.articles[a.id];
  return x ? { ...a, question: x.question, answer: x.answer } : a;
}

/**
 * Search in the reader's language. English keeps `searchHelp` from core (keywords and all); another
 * language matches every word of the query against the translated question and answer, questions
 * first — 17 articles do not need an index, they need to be findable in the words on the screen.
 */
function searchSaid(product: ProductKey, text: string, locale: Locale, t: HelpStrings): HelpArticle[] {
  if (locale === "en") return searchHelp({ product, text }, 20);
  const words = text.toLocaleLowerCase("bg").split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return [];
  return helpForProduct(product)
    .map((a) => said(a, t))
    .map((a) => {
      const q = a.question.toLocaleLowerCase("bg");
      const body = a.answer.toLocaleLowerCase("bg");
      if (!words.every((w) => q.includes(w) || body.includes(w))) return null;
      return { a, score: words.filter((w) => q.includes(w)).length };
    })
    .filter((x): x is { a: HelpArticle; score: number } => x !== null)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}

/**
 * The help centre — one component, three products.
 *
 * ## Why it opens showing everything
 *
 * A search box on an empty page asks somebody to guess our vocabulary. Most of what a hotel needs is
 * *"where is the thing"*, and they do not know what we call it — so the page opens as a browsable
 * map grouped by the question a person is actually asking ("Where do I find…", "It is not working"),
 * and the search narrows it. Nobody has to guess a keyword to get started.
 *
 * ## Why the answers are open, not linked
 *
 * Sixteen answers do not need sixteen pages. Every answer is on this page, expandable in place, so
 * scanning is one scroll rather than a sequence of back buttons — and the browser's own find works
 * across all of it, which no set of separate pages can offer.
 */
export function HelpCentre({ product }: { product: ProductKey; productName?: string }) {
  const locale = useLocale();
  const t = translate(helpStrings, locale);
  const [query, setQuery] = useState("");
  const all = useMemo(() => helpForProduct(product).map((a) => said(a, t)), [product, t]);
  const results = useMemo(
    () => (query.trim() ? searchSaid(product, query, locale, t).map((a) => said(a, t)) : null),
    [product, query, locale, t],
  );

  const grouped = HELP_CATEGORIES.map((c) => ({
    ...c,
    ...t.categories[c.key],
    articles: all.filter((a) => a.category === (c.key as HelpCategory)),
  })).filter((g) => g.articles.length > 0);

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="sr-only">{t.searchLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[14px] text-ink-900 outline-none transition-colors focus:border-brand-600"
        />
      </label>

      {results ? (
        results.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-white p-5">
            <p className="text-[13.5px] font-medium text-ink-900">{t.noMatchTitle}</p>
            <p className="mt-1 text-[13px] text-ink-600">{t.noMatchBody}</p>
          </div>
        ) : (
          <Section title={results.length === 1 ? t.answerOne : fill(t.answerMany, { n: results.length })} articles={results} />
        )
      ) : (
        grouped.map((g) => (
          <Section key={g.key} title={g.label} blurb={g.blurb} articles={g.articles} />
        ))
      )}

      <p className="text-[12.5px] text-ink-500">
        {t.notHere} {t.getHelp}
      </p>
    </div>
  );
}

function Section({
  title,
  blurb,
  articles,
}: {
  title: string;
  blurb?: string;
  articles: readonly { id: string; question: string; answer: string }[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-surface-border bg-white">
      <div className="border-b border-surface-border bg-surface-muted/50 px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink-900">{title}</h2>
        {blurb ? <p className="text-[11.5px] text-ink-500">{blurb}</p> : null}
      </div>
      <ul className="divide-y divide-surface-border">
        {articles.map((a) => (
          <li key={a.id}>
            <details id={a.id} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13.5px] font-medium text-ink-800 transition-colors hover:bg-surface-muted">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {a.question}
              </summary>
              <p className="whitespace-pre-line px-4 pb-4 pl-[38px] text-[13px] leading-relaxed text-ink-600">
                {a.answer}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
