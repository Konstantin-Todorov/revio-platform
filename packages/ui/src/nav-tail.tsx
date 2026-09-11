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
