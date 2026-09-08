"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the server which screen is open, once per navigation.
 *
 * ## Why a client component at all
 *
 * A layout cannot see the route — and in the App Router a shared layout is not re-rendered when you
 * move between the pages inside it, so a server-side recorder in the layout would only ever see the
 * first screen of a session. Reading the path in the browser is the only way to see the rest.
 *
 * ## Why it is this small
 *
 * No queue, no batching, no timers, no session ids. One call when the path changes, fired and
 * forgotten — the server counts it into a daily bucket. Batching would trade a real risk (losing the
 * last screens of a session, or holding a growing buffer in a tab left open at reception for a week)
 * against a saving we do not need: a hotel with twelve staff produces a few thousand of these a day.
 *
 * `sentFor` guards React's development double-render and any re-render that does not change the
 * path, so one navigation is one count.
 *
 * The action comes from the app: `@revio/ui` holds no session and no perimeter.
 */
export function UsageBeacon({ record }: { record: (path: string) => Promise<void> }) {
  const pathname = usePathname();
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || sentFor.current === pathname) return;
    sentFor.current = pathname;
    // Deliberately not awaited and deliberately swallowed: nothing on the screen depends on it.
    void record(pathname).catch(() => {});
  }, [pathname, record]);

  return null;
}
