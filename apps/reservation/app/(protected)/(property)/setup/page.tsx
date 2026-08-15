import { redirect } from "next/navigation";

/**
 * Y3 — never served from a cache.
 *
 * This screen shows live state, so a cached copy is a wrong answer rather than a stale page. Every
 * other live screen in this app already declared this; these were the ones that had been missed, so
 * they were dynamic only as a side effect of reading the session cookie.
 */
export const dynamic = "force-dynamic";

/** Merged into Rooms & Rates (spec §2) — physical counts + OOO/closure periods live there now. */
export default function Page() {
  redirect("/rooms-rates");
}
