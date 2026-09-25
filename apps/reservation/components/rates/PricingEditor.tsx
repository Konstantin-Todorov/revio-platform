"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { rates as ratesDict } from "@/lib/i18n/rates";

import { useState, useTransition } from "react";
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


/**
 * Per-plan pricing model (OBP §4.3) — edited on the plan's own page (Rooms & Rates → Rate plans).
 *
 * A hotel is not obliged to price everything the same way, and the common real case is exactly the
 * mixed one: a room-only rate sold per room, a half-board rate sold per person because the meals
 * are per person. Channex carries `sell_mode` on the rate plan rather than the property, so the
 * mixture survives the push.
 *
 * A plan left on "Follow the property" is not the same as a plan explicitly set to the property's
 * current model: the first tracks a later change to the property default, the second does not.
 */
export function PricingEditor({ plan, propertyModel, onClose }: { plan: PricingPlan; propertyModel: string; onClose: () => void }) {
  const [choice, setChoice] = useState<string>(plan.pricingModel ?? "inherit");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const effective = choice === "inherit" ? propertyModel : choice;
  const s = translate(ratesDict, useLocale());
  const p = s.pricing;

  return (
    <Modal open onClose={onClose} title={p.title(plan.name)}>
      <form
        action={(fd) => start(async () => {
          const r = await saveRatePlanOccupancy(fd);
          if (r.ok) onClose(); else setError(r.error);
        })}
        className="space-y-3.5"
      >
        <input type="hidden" name="ratePlanId" value={plan.id} />
        <Field label={p.model}>
          <select name="pricingModel" value={choice} onChange={(e) => setChoice(e.target.value)} className={inputCls}>
            <option value="inherit">{p.inherit(s.pricingModel[propertyModel as "per_room"] ?? propertyModel)}</option>
            <option value="per_room">{p.perRoom}</option>
            <option value="per_person">{p.perPerson}</option>
          </select>
        </Field>

        {effective === "per_person" && (
          <Field
            label={p.pricedAt}
            hint={p.pricedAtHint(plan.ceiling)}
          >
            <input
              name="primaryOccupancy" type="number" min={1} max={plan.ceiling}
              defaultValue={plan.primaryOccupancy ?? Math.min(2, plan.ceiling)} className={inputCls}
            />
          </Field>
        )}

        {error && <p className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-[12px] font-medium text-danger-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-700">{s.save.cancel}</button>
          <button type="submit" disabled={pending} className="rounded-md bg-brand-700 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {pending ? s.save.saving : s.save.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
