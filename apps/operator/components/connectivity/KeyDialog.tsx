"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { setConnectivityKey, type ActionResult } from "@/lib/actions-connectivity";
import { Modal, Field, inputCls } from "@/components/ui/Modal";

const MODE_LABEL: Record<string, string> = { channex_sandbox: "Channex · sandbox", channex_prod: "Channex · production" };

export function KeyDialog({ tenantId, tenantName, mode, hasKey }: { tenantId: string; tenantName: string; mode: string; hasKey: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(setConnectivityKey, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700"
      >
        {hasKey ? "Replace" : "Set key"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${MODE_LABEL[mode] ?? mode} key`}>
        <p className="mb-3 text-[12.5px] text-ink-500">
          API key for <span className="font-semibold text-ink-800">{tenantName}</span>. Stored{" "}
          <span className="font-semibold text-ink-800">encrypted at rest</span> (AES-256-GCM) and used only
          server-side at push/pull time — never shown to the hotel, never echoed back here.
        </p>
        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="mode" value={mode} />
          <Field label="API key" hint="Paste the Channex user-api-key">
            <input name="apiKey" type="password" required autoComplete="off" className={inputCls} placeholder="uUfMh…" />
          </Field>
          {state?.error && <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>}
          {/* A key that authenticates but sees no properties is not yet usable. Saying so here stops
              the green tick implying the hotel is ready to push. */}
          {state?.warning && <p className="rounded-md bg-warning-50 px-3 py-2 text-[12.5px] font-medium text-warning-700">{state.warning}</p>}
          <p className="rounded-md bg-warning-50 px-3 py-2 text-[11.5px] text-warning-700">
            <strong className="font-semibold">Only for a hotel that brings its own Channex account.</strong>{" "}
            Almost none do — we are the Channex partner, and a key here <em>overrides</em> our platform key for
            this client. If you are not sure, leave it unset.
          </p>
          <p className="text-[11.5px] text-ink-400">
            The key is tested against Channex before it is saved. A key Channex rejects is not stored.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted">Cancel</button>
            <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
              <KeyRound className="h-4 w-4" /> {pending ? "Saving…" : "Save encrypted"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}