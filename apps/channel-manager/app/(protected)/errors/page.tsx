import { redirect } from "next/navigation";

/**
 * Y3 — never served from a cache.
 *
 * This screen answers "what is true right now": rooms on sale, arrivals today, what the channels
 * just did. A cached copy of that is not a stale page, it is a wrong answer — and it was previously
 * dynamic only as a SIDE EFFECT of reading the session cookie. Anything that stopped reading the
 * session would silently have become static and been held by Next for five minutes.
 *
 * Stating it means a future refactor cannot take it away by accident.
 */
export const dynamic = "force-dynamic";

// V2 IA: the Error Center lives inside the Sync Center now.
export default function Page() {
  redirect("/sync?tab=errors");
}
