"use client";

import { useMemo, useState } from "react";
import {
  HELP_CATEGORIES,
  helpForProduct,
  searchHelp,
  type HelpCategory,
  type ProductKey,
} from "@revio/core";

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
export function HelpCentre({ product, productName }: { product: ProductKey; productName: string }) {
  const [query, setQuery] = useState("");
  const all = useMemo(() => helpForProduct(product), [product]);
  const results = useMemo(
    () => (query.trim() ? searchHelp({ product, text: query }, 20) : null),
    [product, query],
  );

  const grouped = HELP_CATEGORIES.map((c) => ({
    ...c,
    articles: all.filter((a) => a.category === (c.key as HelpCategory)),
  })).filter((g) => g.articles.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">Help</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          {productName} — how things work and where to find them.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Search help</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — try “price”, “stop sell”, “check out”"
          className="w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[14px] text-ink-900 outline-none transition-colors focus:border-brand-600"
        />
      </label>

      {results ? (
        results.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-white p-5">
            <p className="text-[13.5px] font-medium text-ink-900">Nothing here matches that.</p>
            <p className="mt-1 text-[13px] text-ink-600">
              That is a gap in our help rather than a bad question. Use <strong>Get help</strong> in
              the menu under your name — it reaches a person, and it tells us what to write next.
            </p>
          </div>
        ) : (
          <Section title={`${results.length} answer${results.length === 1 ? "" : "s"}`} articles={results} />
        )
      ) : (
        grouped.map((g) => (
          <Section key={g.key} title={g.label} blurb={g.blurb} articles={g.articles} />
        ))
      )}

      <p className="text-[12.5px] text-ink-500">
        Not here? <strong>Get help</strong> in the menu under your name sends it to us with the
        screen you are on already attached.
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
