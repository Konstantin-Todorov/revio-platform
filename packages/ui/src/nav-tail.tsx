import { History, LifeBuoy, Settings, type LucideIcon } from "lucide-react";

/**
 * The bottom of every hotel product's sidebar, in one place.
 *
 * ## Why it is shared
 *
 * The founder, 2026-09-11: *"we should have in the main menu more similar ending with help and
 * settings everywhere to be in the bottom because they have to be easy to find."* They were right,
 * and the three products had drifted further than it looked:
 *
 *   RevioLink   Users · Guest Emails · Settings · Help, in a bottom-anchored "Account" group
 *   RevioCRS    Settings · Help · **Activity**, mixed into a "Configuration" group with Distribution
 *               and Booking Engine, which are work rather than settings
 *   RevioPMS    Help · Activity inside "Setup", then "Close Day" BELOW everything — and **no link
 *               to Settings at all**, which made its own settings screens reachable only from the
 *               account dropdown
 *
 * Three sidebars meant three answers to one question. This is the fourth rule of
 * `docs/UI-STANDARD.md` applied to navigation: one component per concept.
 *
 * ## Why this order, and why Settings is last
 *
 * **Settings is the bottom-most item in every product**, because the bottom corner is the strongest
 * muscle-memory target a sidebar has — you throw the pointer at it without reading — and because
 * every operating system and every piece of software these people already use puts it there. Help
 * sits directly above it: the two are reached in the same frame of mind, *"I am stuck"* or *"I need
 * to change how this works"*. Activity is the bridge from the work to the system — what happened,
 * rather than what to do next.
 *
 * ## The separation is the point
 *
 * Above the rule is the hotel's work, and it differs per product because the products differ. Below
 * it is the software itself, and that must not differ, because somebody who runs RevioPMS at the
 * desk and opens RevioCRS once a week should not have to look for it twice.
 *
 * A product without one of these routes simply omits it — the order of the rest is unchanged, so
 * Settings stays last and Help stays above it everywhere.
 */
export interface NavTailItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const TAIL: NavTailItem[] = [
  // What happened. Closest to the work, so it sits first.
  { href: "/activity", label: "Activity", Icon: History },
  { href: "/help", label: "Help", Icon: LifeBuoy },
  // ⚠️ Always last, in every product. Do not reorder.
  { href: "/settings", label: "Settings", Icon: Settings },
];

/**
 * The tail for one product, keeping only the routes it actually has.
 *
 * Filtering rather than three hand-written lists: a product that gains `/activity` later gets it in
 * the right place by adding one string, and cannot get it in the wrong place at all.
 */
export function navTail(hasRoutes: readonly string[]): NavTailItem[] {
  return TAIL.filter((item) => hasRoutes.includes(item.href));
}

/**
 * The scrolling region of a sidebar, styled so a person can SEE that it scrolls.
 *
 * ## The bug this closes
 *
 * Measured on 2026-09-11: RevioPMS's menu needs 767px and has 611px at a 1280×720 laptop — four
 * items' worth below the fold — and RevioLink overflows by 73px at 600px. That on its own is
 * survivable. What is not: **`nav.offsetWidth - nav.clientWidth` was 0**, meaning macOS drew an
 * overlay scrollbar that is invisible until you already scroll. So there was no indication of any
 * kind that the menu continued, and the founder reported exactly the consequence — *"some users
 * might not have the intent to scroll, they may not think of scrolling"*. A screen nobody scrolls
 * to is a feature nobody learns exists.
 *
 * Styling `::-webkit-scrollbar` opts the element out of overlay scrollbars entirely, so the track
 * is always laid out and the thumb is always drawn. That is the whole fix: the oldest, most
 * universally understood "there is more here" signal in software, which we had switched off by
 * accident.
 *
 * ## Why a class string and not a stylesheet
 *
 * The three apps have no shared CSS file — each owns its own `globals.css`, so a rule written for
 * one would have to be copied three times and would diverge. Every app's Tailwind config DOES scan
 * `packages/ui/src/**`, so a class list written here is generated into all three from one place.
 */
export const NAV_SCROLL_CLASS = [
  "overflow-y-auto",
  /*
   * ⚠️ `scrollbar-width` and `scrollbar-color` are deliberately NOT set here, and that is the whole
   * trick. Chrome 121+ implements the standard properties, and when either is present it **ignores
   * every `::-webkit-scrollbar` rule on the element**. Setting both — the obvious thing to do for
   * cross-browser coverage — silently cancelled this fix: measured, the scrollbar still took zero
   * width and was still invisible. The pseudo-elements alone are what opt the element out of
   * macOS's overlay scrollbar and give it a track that is always laid out and always drawn.
   */
  "[&::-webkit-scrollbar]:w-[10px]",
  "[&::-webkit-scrollbar-track]:bg-transparent",
  "[&::-webkit-scrollbar-thumb]:rounded-full",
  // A transparent border plus padding-box clipping insets the thumb, so it reads as a slim pill in
  // the margin rather than a bar welded to the edge of the menu.
  "[&::-webkit-scrollbar-thumb]:border-[3px]",
  "[&::-webkit-scrollbar-thumb]:border-transparent",
  "[&::-webkit-scrollbar-thumb]:bg-clip-padding",
  "[&::-webkit-scrollbar-thumb]:bg-white/25",
  "hover:[&::-webkit-scrollbar-thumb]:bg-white/40",
].join(" ");

/**
 * Vertical rhythm for a sidebar row and its group heading, shared so the three cannot drift.
 *
 * ⚠️ These are **tighter than they were**, on purpose and by measurement rather than taste: the old
 * values put RevioPMS 156px past the bottom of a 720px laptop. `py-1.5` on a row and `pt-3` on a
 * heading recover about 92px of that across the longest menu, which is most of the difference
 * between a menu that scrolls and one that does not — while keeping a 34px row, comfortably above
 * the 24px anybody would call cramped and still a large touch target.
 */
export const NAV_ROW_CLASS = "mb-0.5 px-3 py-1.5";
export const NAV_HEADING_CLASS = "px-3 pb-1 pt-3";
