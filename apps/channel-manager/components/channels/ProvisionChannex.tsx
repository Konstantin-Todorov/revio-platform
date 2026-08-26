"use client";

import { useState, useTransition } from "react";
import { Loader2, Radio } from "lucide-react";
import { provisionChannex } from "@/lib/actions-connect";

/**
 * "Set this hotel up for channels" — the step that used to be a script only Revio could run.
 *
 * Shown when a real property has no Channex property yet. Before this existed the Channels page
 * silently offered the mock dialog instead, so a hotel could fabricate a channel and believe it was
 * selling.
 *
 * The cost line is not reassurance, it is the fact: Channex bills per property **with an active
 * channel**. This creates the property, its rooms and its rates and connects nothing, so it starts
 * no meter. Saying so is what makes the button safe to press.
 */
export function ProvisionChannex({ propertyName }: { propertyName: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-dashed border-surface-border bg-white p-6 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Radio className="h-5 w-5" />
      </div>
      <h2 className="text-[15px] font-bold text-ink-900">Set {propertyName} up for channels</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">
        This registers your rooms and rate plans with our distribution network so they can be sent to
        the OTAs. It takes about a minute, and you only do it once.
      </p>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-ink-400">
        Nothing goes on sale and nothing is charged — that happens later, when you connect and
        activate an actual channel.
      </p>

      {error && (
        <p className="mx-auto mt-4 max-w-md rounded-md bg-danger-50 px-3 py-2 text-left text-[12.5px] font-medium text-danger-600">
          {error}
        </p>
      )}

      <button
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await provisionChannex();
            if (!r.ok) setError(r.error);
          })
        }
        disabled={pending}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-brand-800 px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Setting up…" : "Set up channels"}
      </button>
    </div>
  );
}
