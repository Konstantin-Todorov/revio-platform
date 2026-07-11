"use client";

import { useEffect, useState } from "react";

/** Live TTL countdown for an active Hold (spec §3.3) — ticks every 15s so reception sees
 * exactly how long the locked inventory has left before it self-releases. */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <span className="tnum font-bold text-danger-600">expiring…</span>;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <span className={`tnum font-bold ${m < 5 ? "text-danger-600" : "text-warning-600"}`}>
      {m > 0 ? `${m}m ${s}s` : `${s}s`}
    </span>
  );
}
