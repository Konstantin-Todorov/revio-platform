"use client";

import { useTransition } from "react";
import { Building2, Layers } from "lucide-react";
import { setActiveProperty } from "@/lib/actions-session";

/**
 * What a screen shows instead of itself when the user is in portfolio scope.
 *
 * Portfolio scope answers "how is the group doing?" — it is a reporting lens. Most screens are not
 * reports: they configure or operate ONE hotel. Before this existed those screens still rendered,
 * silently editing whichever property happened to sort first, while the switcher said "All
 * properties". That is a quiet mis-write, the worst kind: on the Booking Engine it would have issued
 * a permanent public address to a hotel the user was not looking at.
 *
 * So the ambiguity is resolved by asking, not by guessing.
 */
export function PickProperty({ properties }: { properties: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-xl border border-surface-border bg-white p-6 shadow-card">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Layers className="h-5 w-5" />
        </div>
        <h1 className="text-[17px] font-bold tracking-tight text-ink-900">
          This screen belongs to one hotel
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          You are viewing <span className="font-semibold text-ink-700">All properties</span>, which is for
          comparing performance across the group. This screen changes the settings of a single hotel, so
          choose which one.
        </p>

        <div className="mt-5 space-y-2">
          {properties.map((p) => (
            <button
              key={p.id}
              disabled={pending}
              onClick={() => start(() => void setActiveProperty(p.id))}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-surface-border bg-white px-3.5 py-3 text-left text-[13.5px] font-semibold text-ink-900 transition-colors hover:border-brand-600 hover:bg-brand-50 disabled:opacity-60"
            >
              <Building2 className="h-4 w-4 text-ink-400" />
              {p.name}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11.5px] text-ink-400">
          Dashboard and Analytics still show the whole portfolio — switch back from the picker at the top
          whenever you want the group view.
        </p>
      </div>
    </div>
  );
}
