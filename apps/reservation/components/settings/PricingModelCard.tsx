"use client";

import { useState, useTransition } from "react";
import { Users, Bed, AlertTriangle, Loader2 } from "lucide-react";
import { previewPricingModel, applyPricingModel, type PricingModelPreview } from "@/lib/actions-obp";

const inputCls =
  "h-9 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none focus:border-brand-600";

/**
 * Turning occupancy-based pricing on — CRS §6.2.
 *
 * ## Why this shows a preview before it does anything
 *
 * The toggle touches every rate plan on every room type at once. A hotel with six room types and
 * seven plans is 42 option sets moving on one click, and "your prices changed" is not something a
 * hotelier should discover afterwards.
 *
 * The preview is computed by the same function that performs the change, so what they approve is
 * what happens — not a description written separately and free to drift from it.
 *
 * ## The sentence that does the work
 *
 * "Your current price stays on the primary occupancy." That is the fact that makes this safe to try,
 * it is true in both directions, and it is stated before the button rather than in a help article.
 */
export function PricingModelCard({
  current,
  seedMode,
}: {
  current: "per_room" | "per_person";
  seedMode: "copy" | "derive";
}) {
  const [target, setTarget] = useState<"per_room" | "per_person">(current);
  const [seed, setSeed] = useState<"copy" | "derive">(seedMode);
  const [preview, setPreview] = useState<PricingModelPreview | null>(null);
  const [loading, startPreview] = useTransition();

  const dirty = target !== current;

  return (
    <div className="space-y-4 p-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Pricing model</legend>
        <Choice
          checked={target === "per_room"}
          onSelect={() => { setTarget("per_room"); setPreview(null); }}
          icon={<Bed className="h-4 w-4" />}
          title="Per room"
          body="One price for the room, whoever is in it. The simplest model, and what most UK and US hotels use."
        />
        <Choice
          checked={target === "per_person"}
          onSelect={() => { setTarget("per_person"); setPreview(null); }}
          icon={<Users className="h-4 w-4" />}
          title="Per person"
          body="A price for each number of guests — €80 for one, €100 for two. Standard across most of continental Europe."
        />
      </fieldset>

      {target === "per_person" && (
        <div className="rounded-lg border border-surface-border bg-surface-muted/40 p-3.5">
          <label className="block text-[12px] font-semibold text-ink-700">
            Starting prices for the other guest counts
          </label>
          <select
            value={seed}
            onChange={(e) => { setSeed(e.target.value as "copy" | "derive"); setPreview(null); }}
            className={`${inputCls} mt-1.5 max-w-md`}
          >
            <option value="copy">Use the same price for every guest count (change them afterwards)</option>
            <option value="derive">Work them out from the main price with a rule</option>
          </select>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
            {/* "Copy" is the honest default: not a clever guess, exactly what they charged yesterday,
                and visibly theirs to change. */}
            Either way nothing is guessed for you — the price you charge today stays on your main
            guest count, and you set the rest.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!dirty || loading}
          onClick={() => startPreview(async () => setPreview(await previewPricingModel(target, seed)))}
          className="h-9 rounded-md border border-surface-border px-3.5 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "See what will change"}
        </button>
        {!dirty && (
          <span className="text-[12px] text-ink-400">
            Currently {current === "per_person" ? "per person" : "per room"}.
          </span>
        )}
      </div>

      {preview && (
        <div className="rounded-lg border border-surface-border">
          <p className="border-b border-surface-border px-3.5 py-2.5 text-[13px] font-semibold text-ink-900">
            {preview.summary}
          </p>

          {!preview.noop && (
            <>
              <ul className="divide-y divide-surface-border">
                {preview.rows.map((r) => (
                  <li key={r.planName} className="flex items-center justify-between gap-3 px-3.5 py-2">
                    <span className={`text-[12.5px] ${r.changed ? "font-semibold text-ink-900" : "text-ink-400"}`}>
                      {r.planName}
                    </span>
                    <span className="text-[11.5px] text-ink-500">
                      {r.changed
                        ? `${r.before} price${r.before === 1 ? "" : "s"} → ${r.after}`
                        : (r.note ?? "no change")}
                    </span>
                  </li>
                ))}
              </ul>

              <form action={applyPricingModel} className="flex items-center justify-between gap-3 border-t border-surface-border bg-surface-muted/40 px-3.5 py-2.5">
                <input type="hidden" name="target" value={preview.target} />
                <input type="hidden" name="seed" value={seed} />
                <span className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-600" />
                  {/* Said plainly: this is what reaches the OTAs, and it is reversible. */}
                  Your channels get the new prices on the next sync. You can switch back at any time.
                </span>
                <button
                  type="submit"
                  className="h-9 shrink-0 rounded-md bg-brand-800 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  Apply
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Choice({
  checked, onSelect, icon, title, body,
}: {
  checked: boolean; onSelect: () => void; icon: React.ReactNode; title: string; body: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors ${
        checked ? "border-brand-600 bg-brand-50/40" : "border-surface-border hover:bg-surface-muted"
      }`}
    >
      <input type="radio" name="pricingModel" checked={checked} onChange={onSelect} className="mt-0.5 h-4 w-4 accent-brand-700" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-900">
          {icon}
          {title}
        </span>
        <span className="mt-1 block text-[12px] leading-relaxed text-ink-500">{body}</span>
      </span>
    </label>
  );
}
