"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, BedDouble, Building2, CalendarDays, CalendarPlus, CalendarRange, FileText, HeartPulse, Home, Layers,
  LayoutDashboard, Link2, List, Lock, Menu, Plug, Plus, Receipt, RefreshCw, SlidersHorizontal, Sparkles, UserPlus,
  Wrench, X, type LucideIcon,
} from "lucide-react";

/**
 * The frame around every staff screen on a phone and the "+ New" menu on a desk — one implementation
 * for all four products, because a hotel that runs RevioPMS at the desk and RevioCRS in the office
 * should find the same thing in the same place.
 *
 * ## What decides the buttons
 *
 * The PRODUCT and the ROLE, never the person. A front-desk phone is often shared across a shift, and a
 * bar that rearranges itself is one nobody can use by memory — the whole point of a bottom bar is that
 * the thumb goes there without looking. So each app builds its tabs from the signed-in role
 * (`lib/chrome.ts` in each app) and passes them in; a role with only one screen gets no bar at all.
 * Personal choice lives in the sidebar's favourites, not here.
 *
 * Icons travel as names, not components: the layout that decides the tabs is a server component, and a
 * React component cannot cross that boundary as a prop.
 */

export type ChromeIcon =
  | "home" | "dashboard" | "calendar" | "calendarRange" | "calendarPlus" | "bed" | "sparkles" | "wrench"
  | "list" | "refresh" | "building" | "health" | "receipt" | "userPlus" | "link" | "lock" | "layers"
  | "sliders" | "plug" | "file";

const ICONS: Record<ChromeIcon, LucideIcon> = {
  home: Home, dashboard: LayoutDashboard, calendar: CalendarDays, calendarRange: CalendarRange,
  calendarPlus: CalendarPlus, bed: BedDouble, sparkles: Sparkles, wrench: Wrench, list: List, refresh: RefreshCw,
  building: Building2, health: HeartPulse, receipt: Receipt, userPlus: UserPlus, link: Link2, lock: Lock,
  layers: Layers, sliders: SlidersHorizontal, plug: Plug, file: FileText,
};

export interface ChromeTab {
  href: string;
  label: string;
  icon: ChromeIcon;
  /** What is waiting there — shown as a number on the button. Zero shows nothing. */
  badge?: number;
}

export interface ChromeCreate {
  /** Carries `?new=1` (or is its own page): the target screen opens the form and focuses it. */
  href: string;
  label: string;
  icon: ChromeIcon;
}

export interface ChromeStrings {
  more: string;
  create: string;
  createHeading: string;
  close: string;
  back: string;
  menu: string;
}

/** Any button in any app can open the drawer without holding its state. */
export const MENU_EVENT = "revio:menu";
export const openMenu = () => window.dispatchEvent(new Event(MENU_EVENT));

const isOn = (path: string, href: string) => path === href || path.startsWith(href + "/");

function badgeText(n: number) {
  return n > 99 ? "99+" : String(n);
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open, close]);
  return ref;
}

function CreateList({ items, heading, onPick, up }: { items: ChromeCreate[]; heading: string; onPick: () => void; up?: boolean }) {
  return (
    <div
      role="menu"
      className={`absolute z-50 w-60 rounded-xl border border-surface-border bg-white p-1.5 shadow-lg ${
        up ? "bottom-full left-1/2 mb-3 -translate-x-1/2" : "right-0 top-full mt-2"
      }`}
    >
      <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{heading}</div>
      {items.map((it) => {
        const Icon = ICONS[it.icon];
        return (
          <Link
            key={it.href}
            href={it.href}
            role="menuitem"
            onClick={onPick}
            className="flex min-h-[40px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-800 hover:bg-surface-muted"
          >
            <Icon className="h-4 w-4 shrink-0 text-ink-500" aria-hidden /> {it.label}
          </Link>
        );
      })}
    </div>
  );
}

/** "+ New" in the desk top bar. Lists only what this role may create; renders nothing if that is nothing. */
export function CreateButton({ items, t }: { items: ChromeCreate[]; t: Pick<ChromeStrings, "create" | "createHeading"> }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const ref = useOutside(open, () => setOpen(false));
  useEffect(() => setOpen(false), [path]);
  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-800 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" aria-hidden /> {t.create}
      </button>
      {open && <CreateList items={items} heading={t.createHeading} onPick={() => setOpen(false)} />}
    </div>
  );
}

/**
 * The phone's bottom bar: up to four destinations around a large "+", and "More" opening the full menu.
 * Below `lg`, where the sidebar is a drawer. Absent entirely for a role with no tabs.
 */
export function BottomBar({ tabs, create, t }: { tabs: ChromeTab[]; create: ChromeCreate[]; t: ChromeStrings }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  useEffect(() => setOpen(false), [path]);
  if (tabs.length === 0) return null;

  const tab = (it: ChromeTab) => {
    const Icon = ICONS[it.icon];
    const on = isOn(path, it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={on ? "page" : undefined}
        className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
          on ? "text-brand-800" : "text-ink-500"
        }`}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
        <span className="max-w-full truncate px-1">{it.label}</span>
        {(it.badge ?? 0) > 0 && (
          <span className="absolute left-1/2 top-1 ml-2 min-w-[18px] rounded-full bg-danger-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {badgeText(it.badge!)}
          </span>
        )}
      </Link>
    );
  };

  const half = Math.ceil(tabs.length / 2);
  return (
    <nav
      aria-label={t.menu}
      className="fixed inset-x-0 bottom-0 z-[25] flex items-stretch border-t border-surface-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {tabs.slice(0, half).map(tab)}
      {create.length > 0 && (
        <div ref={ref} className="relative flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={t.create}
            aria-expanded={open}
            aria-haspopup="menu"
            className="-mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-800 text-white shadow-lg ring-4 ring-white"
          >
            {open ? <X className="h-6 w-6" aria-hidden /> : <Plus className="h-6 w-6" aria-hidden />}
          </button>
          {open && <CreateList items={create} heading={t.createHeading} onPick={() => setOpen(false)} up />}
        </div>
      )}
      {tabs.slice(half).map(tab)}
      <button
        type="button"
        onClick={openMenu}
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink-500"
      >
        <Menu className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
        {t.more}
      </button>
    </nav>
  );
}

/** Space under the content so the bottom bar never covers the last row. Matches the bar's height. */
export const BOTTOM_BAR_SPACE = "pb-24 lg:pb-6";

/** The open screen's name on a phone, where the search box gives way to it. Longest matching route wins. */
export function ScreenTitle({ nav, fallback }: { nav: { href: string; label: string }[]; fallback: string }) {
  const path = usePathname();
  let best: { href: string; label: string } | null = null;
  for (const n of nav) if (isOn(path, n.href) && (!best || n.href.length > best.href.length)) best = n;
  return <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-900 md:hidden">{best?.label ?? fallback}</span>;
}

/**
 * "+ New" lands on `?new=1`: the screen's create control, marked `data-new`, is opened and focused.
 * A button (a dialog trigger) is clicked; a form or <details> is opened and its first field focused.
 */
export function FocusNew() {
  // useSearchParams needs a Suspense boundary, or Next renders the whole layout client-side.
  return <Suspense fallback={null}><FocusNewInner /></Suspense>;
}

function FocusNewInner() {
  const params = useSearchParams();
  useEffect(() => {
    const which = params.get("new");
    if (!which) return;
    // `?new=1` takes the screen's one create control; a screen with two names them (`?new=restriction`).
    const selector = which === "1" ? "[data-new]" : `[data-new="${CSS.escape(which)}"]`;
    /*
     * Waits for the control to be live, not just present. A dialog trigger clicked before React has
     * hydrated it does nothing — the button exists in the server HTML long before its handler does.
     */
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      const el = document.querySelector<HTMLElement>(selector);
      const live = el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
      if (!live && tries < 40) return;
      clearInterval(id);
      if (!el) return;
      if (el instanceof HTMLButtonElement) { el.click(); return; }
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: "center" });
      el.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")?.focus();
    }, 100);
    return () => clearInterval(id);
  }, [params]);
  return null;
}

/**
 * "← Back" for the app installed on a phone's home screen. Opened that way there is no browser bar and
 * so no back button at all, and a screen reached from a link was a dead end. Shown only in standalone
 * display mode, and not on the bottom bar's own screens, which are where "back" would lead anyway.
 */
export function AppBack({ label, roots }: { label: string; roots: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
  }, []);
  if (!standalone || roots.some((r) => path === r)) return null;
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex h-10 shrink-0 items-center gap-1 rounded-md pr-2 text-[13.5px] font-medium text-ink-700 hover:bg-surface-muted"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> {label}
    </button>
  );
}

/**
 * The drawer's behaviour on a phone, for every app's ShellProvider:
 * - opens from the bottom bar's "More" (the `revio:menu` event);
 * - opens with a swipe in from the left edge, and closes with a swipe back;
 * - locks the page behind it, so a scroll inside the menu never moves the screen underneath.
 */
export function useDrawer(open: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(MENU_EVENT, show);
    return () => window.removeEventListener(MENU_EVENT, show);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    let x0: number | null = null;
    let y0 = 0;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || window.innerWidth >= 1024) return;
      // From the very edge to open; from anywhere to close.
      x0 = open || t.clientX <= 24 ? t.clientX : null;
      y0 = t.clientY;
    };
    const end = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (x0 == null || !t) return;
      const dx = t.clientX - x0;
      const dy = Math.abs(t.clientY - y0);
      x0 = null;
      if (dy > 60) return; // a scroll, not a swipe
      if (!open && dx > 60) setOpen(true);
      if (open && dx < -60) setOpen(false);
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => { document.removeEventListener("touchstart", start); document.removeEventListener("touchend", end); };
  }, [open, setOpen]);
}
