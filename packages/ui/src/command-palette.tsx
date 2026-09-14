"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";
import { groupHits, isSearchable, rankHits, shortcutLabel, type SearchHit } from "@revio/core";

/**
 * ⌘K / Ctrl K — one palette, four products.
 *
 * ## What it replaces
 *
 * Every app had a topbar form that posted to `/search`: type, press Enter, wait for a page, read a
 * list, click, wait again. Three navigations to reach a booking somebody is standing in front of
 * you asking about. The results page stays — it is still the right place for "show me everything
 * matching" — and this is the fast path to one known thing.
 *
 * ## What is shared and what is not
 *
 * The palette, the keyboard handling and the ranking are shared, because "which result is best" is
 * not a per-product opinion. What each product SEARCHES is entirely its own: `search` is a prop, so
 * RevioPMS looks in guests and rooms while the operator console looks across every hotel. A shared
 * component that knew about both would have to know about tenancy, and this one deliberately does
 * not.
 *
 * ## Three details that decide whether it feels fast
 *
 * 1. **A generation counter, not just a debounce.** Slow queries return out of order; without it,
 *    typing "mar" then "maria" can leave you looking at the results for "mar" with "maria" in the
 *    box. Every response carries the query that asked for it and a stale one is dropped.
 * 2. **The previous results stay on screen while new ones load.** Blanking the list on each
 *    keystroke makes a fast search feel broken, because the eye reads the flicker as a failure.
 * 3. **Arrow keys move a highlight the mouse cannot fight.** Hover does not steal the selection
 *    while you are typing — that is how people end up opening the row under the cursor by accident.
 */
export function CommandPalette({
  search,
  placeholder = "Search…",
  seeAllHref,
  onNavigate,
}: {
  /** Runs on the server. Returns anything plausible; the ranking here decides what is shown. */
  search: (query: string) => Promise<SearchHit[]>;
  placeholder?: string;
  /** Where Enter goes when nothing is highlighted — the full results page. */
  seeAllHref?: (query: string) => string;
  /**
   * Called with the chosen result's href, and the hit itself when there is one.
   *
   * ⚠️ The hit is passed so the app can do what only it knows how to do: a record in another
   * property needs the active workspace switched before its screen can open it. The palette
   * deliberately does not know about properties or cookies — it hands over what it chose.
   */
  onNavigate: (href: string, hit?: SearchHit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const [mod, setMod] = useState("⌘K");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Only the newest request may write results. See note 1 above. */
  const gen = useRef(0);

  useEffect(() => {
    setMod(shortcutLabel(navigator.platform || navigator.userAgent || ""));
  }, []);

  const ranked = rankHits(hits, q);
  const groups = groupHits(ranked);
  const flat = groups.flatMap((g) => g.hits);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        // Select only when re-opening onto an existing query; selecting an empty box does nothing
        // useful and, with a password manager involved, made it look pre-filled.
        requestAnimationFrame(() => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          if (el.value) el.select();
        });
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(async (query: string) => {
    const mine = ++gen.current;
    if (!isSearchable(query)) {
      setHits([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const res = await search(query);
      // ⚠️ A slower earlier request must never overwrite a faster later one.
      if (gen.current !== mine) return;
      setHits(res);
      setActive(0);
    } catch {
      if (gen.current === mine) setHits([]);
    } finally {
      if (gen.current === mine) setBusy(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void run(q), 140);
    return () => clearTimeout(t);
  }, [q, open, run]);

  const close = () => { setOpen(false); setQ(""); setHits([]); setActive(0); gen.current++; };

  const choose = (h: SearchHit) => { close(); onNavigate(h.href, h); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) choose(hit);
      // Nothing highlighted and something typed: fall through to the full results page, which is
      // what the topbar form did and is still the right answer for "show me everything".
      else if (seeAllHref && q.trim()) { close(); onNavigate(seeAllHref(q)); }
    }
  };

  // Keep the highlight in view when the arrows walk past the fold.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  /*
   * ⚠️ The overlay is PORTALLED to <body>, and it has to be.
   *
   * This component renders inside the topbar, which is `sticky` with a z-index — and that creates a
   * stacking context. A `position: fixed` child cannot escape one, so `inset-0` covered the topbar
   * and nothing else: the bar dimmed, the page underneath stayed bright, and it read as a broken
   * backdrop rather than a dialog. Reported on sight, which is the only way this kind of bug is
   * ever found.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* The trigger keeps the position the search box already had — it is not moved, only
          replaced. Full width of its slot on desktop, an icon on a phone. */}
      <button
        type="button"
        onClick={() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }}
        className="hidden h-9 w-full max-w-md items-center gap-2 rounded-md border border-surface-border bg-surface-muted px-3 text-[13px] text-ink-400 transition-colors hover:border-ink-300 hover:bg-white md:flex"
        aria-label="Search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">{placeholder}</span>
        <kbd className="ml-auto shrink-0 rounded border border-surface-border px-1.5 py-0.5 text-[10.5px] font-medium text-ink-400">{mod}</kbd>
      </button>
      <button
        type="button"
        onClick={() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }}
        className="flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-surface-muted md:hidden"
        aria-label="Search"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-ink-900/35 backdrop-blur-[3px]"
          onMouseDown={close}
          role="presentation"
        >
          <div
            className="mx-auto mt-[12vh] w-[min(600px,calc(100vw-24px))] overflow-hidden rounded-xl bg-white shadow-overlay"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="flex items-center gap-2.5 border-b border-surface-border px-4 py-3">
              <Search className="h-[17px] w-[17px] shrink-0 text-ink-400" />
              {/*
                ⚠️ Two browser behaviours are being fought here, plus one of our own.

                **Ours:** `globals.css` puts a 3px focus ring on every input and gives fields a
                `box-shadow` precisely so it survives a suppressed outline — an accessibility rule worth
                keeping, and wrong here. This dialog opens focused and has exactly one field, so the
                ring is permanently on and answers a question the dialog itself already answered:
                the founder read it as a selection box drawn round an empty input. It is suppressed
                for THIS input only, and only when not autofilled, so the white inset below still
                wins in the case it exists for.
                ⚠️ Everything here is fighting the browser's password manager.
                It was autofilling this box with a saved email the moment it opened, so the palette
                appeared with blue, selected-looking text over the placeholder — which reads as
                somebody else's software leaking into ours. `autoComplete="off"` alone is ignored by
                Chrome; the type, the vendor opt-outs and the `autofill:` overrides are all needed,
                and the last one is what removes the blue if it autofills anyway.
              */}
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                aria-label="Search"
                autoComplete="off"
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore
                spellCheck={false}
                /* a11y-lint: focus shown by the dialog — one focusable field, opened focused,
                   caret already in it, and no second control for focus to move to. The permanent
                   ring read as a selection box drawn round an empty input. Arrow keys drive the
                   list below, which paints its own `data-active` highlight. */
                className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-ink-900 outline-none [&:focus-visible:not(:-webkit-autofill)]:shadow-none placeholder:text-ink-400 autofill:bg-transparent autofill:shadow-[inset_0_0_0_1000px_white] autofill:[-webkit-text-fill-color:#1c2733]"
              />
              {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-300" />}
              <kbd className="shrink-0 rounded border border-surface-border px-1.5 py-0.5 text-[10.5px] text-ink-400">esc</kbd>
            </div>

            <div ref={listRef} className="max-h-[min(56vh,420px)] overflow-y-auto p-1.5">
              {!isSearchable(q) ? (
                <p className="px-3 py-8 text-center text-[12.5px] text-ink-400">
                  Type at least two characters.
                </p>
              ) : ranked.length === 0 ? (
                <p className="px-3 py-8 text-center text-[12.5px] text-ink-400">
                  {busy ? "Searching…" : <>Nothing matches &ldquo;{q}&rdquo;.</>}
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.kind}>
                    <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold text-ink-400">{g.label}</p>
                    {g.hits.map((h) => {
                      const i = flat.indexOf(h);
                      return (
                        <button
                          key={`${h.kind}-${h.id}`}
                          type="button"
                          data-active={i === active}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => choose(h)}
                          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors data-[active=true]:bg-surface-muted"
                        >
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-[13px] font-medium text-ink-900">{h.title}</span>
                            {h.subtitle && <span className="block truncate text-[11.5px] text-ink-500">{h.subtitle}</span>}
                          </span>
                          {/* ⚠️ Which property. Search now reaches every property the account holds,
                              and two identically named rooms are indistinguishable without this. */}
                          {h.context && (
                            <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-ink-500">
                              {h.context}
                            </span>
                          )}
                          {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-300" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {seeAllHref && isSearchable(q) && (
              <button
                type="button"
                onClick={() => { close(); onNavigate(seeAllHref(q)); }}
                className="w-full border-t border-surface-border px-4 py-2.5 text-left text-[12px] font-semibold text-brand-600 transition-colors hover:bg-surface-muted"
              >
                See every result for &ldquo;{q}&rdquo; →
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
