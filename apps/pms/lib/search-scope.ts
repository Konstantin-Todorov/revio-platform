// Plain module (no "use server") so it can be unit-tested: a "use server" file may only export
// async functions, and a security filter that cannot be tested is a security filter nobody checks.
import type { SearchHit } from "@revio/core";
import { roleAllowsPath } from "./roles";

/**
 * ⚠️ **Search must never show what the person cannot open.**
 *
 * The founder's scenario, and the right one to design against: *"a housekeeper tried to search
 * something and it pops something from the admin point of view and somehow she can bridge the system
 * and go to places where she has no access."*
 *
 * Two separate failures live in that sentence, and blocking the click only fixes one. The link is
 * the smaller half — the layout already bounces a scoped role that types a URL. The larger half is
 * that the result ROW is itself data: a guest's name and e-mail, who is staying in 214 tonight, what
 * a folio is worth. Rendering the list has already leaked it, whatever happens on click.
 *
 * So the filter drops hits, and it asks `roleAllowsPath` — the same function that draws the sidebar
 * and guards the layout — rather than inventing a second rule that would drift from the menu.
 */
export function visibleTo(role: string, hits: readonly SearchHit[]): SearchHit[] {
  return hits.filter((h) => roleAllowsPath(role, h.href));
}

/**
 * Where a room hit should point, for the person doing the looking.
 *
 * ⚠️ The same physical room is a different object to each role, and a single href gets one of them
 * wrong. To a housekeeper, 214 is a card on the cleaning board; to a maintenance technician it is a
 * record in the room inventory, and she cannot open his screen any more than he can open hers. A
 * fixed `/housekeeping` link made the room invisible to maintenance — found by the test below, not
 * by reading the code.
 *
 * Resolving against `roleAllowsPath` rather than a second role→screen table means this cannot drift
 * from the menu: change what a role may open and this follows.
 */
export function firstAllowed(role: string, candidates: readonly string[]): string | null {
  return candidates.find((href) => roleAllowsPath(role, href)) ?? null;
}
