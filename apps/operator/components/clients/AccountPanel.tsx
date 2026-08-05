"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarClock, Pencil, UserRound } from "lucide-react";
import { saveAccount, markRenewed, type ActionResult } from "@/lib/actions-crm";
import { STAGES, STAGE_LABEL, renewalStatus, type Stage } from "@/lib/account";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";

const STAGE_TONE: Record<Stage, "success" | "info" | "warning" | "danger" | "neutral"> = {
  prospect: "neutral",
  onboarding: "info",
  live: "success",
  at_risk: "warning",
  churned: "danger",
};

export interface AccountView {
  stage: Stage;
  ownerOperatorId: string | null;
  ownerOperatorName: string | null;
  renewalDate: string | null; // YYYY-MM-DD
  contractTermMonths: number | null;
  summary: string | null;
}

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

/**
 * The commercial relationship, above the numbers.
 *
 * The one thing this panel does that a plain form would not: it shows the stage we BELIEVE beside the
 * stage the data OBSERVES, and only remarks when they differ. Auto-computing the stage would quietly
 * overwrite a human judgement; never checking it would let that judgement rot for a year. Keeping
 * both and naming the disagreement is the only version that tells you something you did not know.
 */
export function AccountPanel({
  tenantId, account, observed, operators, lastContactAt,
}: {
  tenantId: string;
  account: AccountView;
  observed: Stage;
  operators: { id: string; name: string }[];
  lastContactAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveAccount, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  const renewal = renewalStatus(account.renewalDate ? new Date(`${account.renewalDate}T00:00:00Z`) : null);
  const disagrees = observed !== account.stage;

  return (
    <Card>
      <CardHeader
        title="Account"
        action={
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        }
      />
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={STAGE_TONE[account.stage]}>{STAGE_LABEL[account.stage]}</StatusPill>
          {disagrees && (
            <span className="text-[11.5px] text-ink-500">
              their usage looks <span className="font-semibold text-ink-700">{STAGE_LABEL[observed].toLowerCase()}</span>
            </span>
          )}
        </div>

        {account.summary && (
          <p className="rounded-md bg-surface-sunken px-3 py-2 text-[12.5px] leading-relaxed text-ink-700">{account.summary}</p>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          <div>
            <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-400"><UserRound className="h-3 w-3" /> Account manager</dt>
            <dd className="mt-0.5 font-semibold text-ink-900">{account.ownerOperatorName ?? <span className="font-normal text-ink-300">unassigned</span>}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-ink-400">Last contact</dt>
            <dd className="mt-0.5 font-semibold text-ink-900">{ago(lastContactAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-ink-400"><CalendarClock className="h-3 w-3" /> Renewal</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2">
              {account.renewalDate ? (
                <>
                  <span className="font-semibold text-ink-900">{account.renewalDate}</span>
                  {account.contractTermMonths && <span className="text-[11.5px] text-ink-400">{account.contractTermMonths}-month term</span>}
                  {renewal && (
                    <span className={`text-[12px] font-semibold ${renewal.severity === "act" ? "text-danger-600" : "text-warning-600"}`}>
                      {renewal.label}
                    </span>
                  )}
                  {/* Rolling the date forward is one click, because a renewal date that has to be
                      retyped ends up permanently in the past and the flag then cries wolf forever. */}
                  <form action={markRenewed}>
                    <input type="hidden" name="tenantId" value={tenantId} />
                    <button className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">
                      Mark renewed
                    </button>
                  </form>
                </>
              ) : (
                <span className="text-ink-300">no date set</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Account record">
        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="tenantId" value={tenantId} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage" hint={disagrees ? `Their usage looks ${STAGE_LABEL[observed].toLowerCase()}.` : undefined}>
              <select name="stage" defaultValue={account.stage} className={inputCls}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="Account manager">
              <select name="ownerOperatorId" defaultValue={account.ownerOperatorId ?? ""} className={inputCls}>
                <option value="">Unassigned</option>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Renewal date">
              <input type="date" name="renewalDate" defaultValue={account.renewalDate ?? ""} className={inputCls} />
            </Field>
            <Field label="Contract term (months)" hint="Used when you mark them renewed.">
              <input type="number" min={1} max={120} name="contractTermMonths" defaultValue={account.contractTermMonths ?? 12} className={inputCls} />
            </Field>
          </div>
          <Field label="Before you call" hint="The one line you want in front of you when they pick up.">
            <textarea
              name="summary"
              defaultValue={account.summary ?? ""}
              rows={3}
              className="w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600"
              placeholder="Owner-run, price sensitive, decided by Maria. Wants RevioPMS once the second building opens."
            />
          </Field>

          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
