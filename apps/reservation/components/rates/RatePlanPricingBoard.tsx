"use client";

import { useState, useTransition } from "react";
import { Pencil, User, BedDouble } from "lucide-react";
import { saveRatePlanOccupancy } from "@/lib/actions-obp";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

export type PricingPlan = {
  id: string;
  name: string;
  active: boolean;
  /** null = follows the property. Channex sets `sell_mode` per rate plan, so a plan may differ. */
  pricingModel: string | null;
  primaryOccupancy: number | null;
  /** The smallest cap among the rooms this plan sells — the highest occupancy it can price. */
  ceiling: number;
  roomCount: number;
};

const MODEL_LABEL: Record<string, string> = { per_room: "Per room", per_person: "Per person" };

/**
 * Per-plan pricing model (OBP §4.3).
 *
 * A hotel is not obliged to price everything the same way, and the common real case is exactly the
 * mixed one: a room-only rate sold per room, a half-board rate sold per person because the meals
 * are per person. Channex carries `sell_mode` on the rate plan rather than the property, so the
 * mixture survives the push — this board is where it is chosen.
 *
 * A plan left on "Follow the property" is not the same as a plan explicitly set to the property's
 * current model: the first tracks a later change to the property default, the second does not.
 */
export function RatePlanPricingBoard({ plans, propertyModel }: { plans: PricingPlan[]; propertyModel: string }) {
  const [editing, setEditing] = useState<PricingPlan | null>(null);
  const mixed = new Set(plans.map((p) => p.pricingModel ?? propertyModel)).size > 1;

  return (
    <div className="p-4">
      <div className="divide-y divide-surface-border/60">
        {plans.length === 0 && <p className="py-4 text-[13px] text-ink-400">Add a rate plan first.</p>}
        {plans.map((p) => {
          const effective = p.pricingModel ?? propertyModel;
          const perPerson = effective === "per_person";
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className={`truncate text-[13px] font-semibold ${p.active ? "text-ink-900" : "text-ink-400 line-through"}`}>{p.name}</div>
                <div className="text-[11px] text-ink-400">
                  {p.roomCount} room type{p.roomCount === 1 ? "" : "s"}
                  {perPerson && ` · sleeps up to ${p.ceiling}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-semibold ${perPerson ? "bg-accent-50 text-accent-700" : "bg-surface-sunken text-ink-600"}`}>
                  {perPerson ? <User className="h-3 w-3" /> : <BedDouble className="h-3 w-3" />}
                  {MODEL_LABEL[effective] ?? effective}
                  {perPerson && p.primaryOccupancy != null && <span className="tnum font-normal text-ink-500">· priced at {p.primaryOccupancy}</span>}
                </span>
                {p.pricingModel == null && (
                  <span title="No choice of its own — follows the property setting" className="rounded bg-surface-muted px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-400">
                    inherited
                  </span>
                )}
                <button
                  type="button" onClick={() => setEditing(p)} title={`Change how ${p.name} prices`}
                  className="flex h-6 w-6 items-center justify-center rounded text-ink-300 transition-colors hover:bg-surface-muted hover:text-brand-600"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11.5px] text-ink-400">
        Most hotels leave every plan following the property. Set a plan on its own when the meals make it
        per person — a half-board rate priced per guest alongside a room-only rate priced per room is a normal
        mixture, and the channels are told plan by plan.
      </p>

      {editing && <PricingEditor plan={editing} propertyModel={propertyModel} onClose={() => setEditing(null)} />}
      {mixed && (
        <p className="mt-2 text-[11.5px] font-medium text-accent-700">
          This property currently sells some plans per room and others per person.
        </p>
      )}
    </div>
  );
}

function PricingEditor({ plan, propertyModel, onClose }: { plan: PricingPlan; propertyModel: string; onClose: () => void }) {
  const [choice, setChoice] = useState<string>(plan.pricingModel ?? "inherit");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const effective = choice === "inherit" ? propertyModel : choice;

  return (
    <Modal open onClose={onClose} title={`How “${plan.name}” prices`}>
      <form
        action={(fd) => start(async () => {
          const r = await saveRatePlanOccupancy(fd);
          if (r.ok) onClose(); else setError(r.error);
        })}
        className="space-y-3.5"
      >
        <input type="hidden" name="ratePlanId" value={plan.id} />
        <Field label="Pricing model">
          <select name="pricingModel" value={choice} onChange={(e) => setChoice(e.target.value)} className={inputCls}>
            <option value="inherit">Follow the property — {MODEL_LABEL[propertyModel] ?? propertyModel}</option>
            <option value="per_room">Per room — one price whoever stays</option>
            <option value="per_person">Per person — the price follows the party size</option>
          </select>
        </Field>

        {effective === "per_person" && (
          <Field
            label="Priced at"
            hint={`The party size the headline price is for. Every other size is worked out from it. This plan's rooms sleep up to ${plan.ceiling}.`}
          >
            <input
              name="primaryOccupancy" type="number" min={1} max={plan.ceiling}
              defaultValue={plan.primaryOccupancy ?? Math.min(2, plan.ceiling)} className={inputCls}
            />
          </Field>
        )}

        {error && <p className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-700">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-700 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
