"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Loader2, ExternalLink } from "lucide-react";
import { loadChannelForm, connectChannel, type ConnectResult, type FormResult } from "@/lib/actions-connect";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import type { ChannelField, FieldRule } from "@revio/connectivity";

type Option = { code: string; name: string };

/**
 * Apply Channex's conditional rules to the values currently in the form.
 *
 * The same logic as `visibleFieldsFor` on the server, and it has to exist in both places: the server
 * decides what is required at submit, and this decides what is on screen a keystroke after the
 * checkbox is ticked. Sharing the pure function would mean importing it into a client bundle for four
 * lines; keeping it here means the rule shape is pinned by the server's tests and mirrored by a form
 * that is visibly wrong the moment it disagrees.
 */
function visibleNow(fields: ChannelField[], values: Record<string, unknown>): ChannelField[] {
  return fields.filter((f) => {
    const rules = f.rules as FieldRule[] | undefined;
    if (!rules) return true;
    for (const r of rules) {
      if (String(values[r.influenceField] ?? "") === String(r.when ?? "")) return r.apply === "shown";
    }
    return true;
  });
}

/**
 * Connect a real OTA — the form Channex describes, not one we wrote.
 *
 * Two steps on purpose. Pick the channel, and the form appears; it cannot appear sooner because we do
 * not know what it contains until Channex tells us. That round trip is the feature: it is why adding
 * Booking.com asks for one field and adding Expedia asks for three, without either being hard-coded.
 */
export function ConnectChannelDialog({
  channels,
  connectedCodes,
}: {
  channels: readonly Option[];
  connectedCodes: string[];
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [form, setForm] = useState<FormResult | null>(null);
  const [loading, startLoading] = useTransition();
  const [state, formAction, pending] = useActionState<ConnectResult | null, FormData>(connectChannel, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setCode("");
      setForm(null);
    }
  }, [state]);

  const available = channels.filter((c) => !connectedCodes.includes(c.code));

  // What is typed so far, so conditional fields appear and disappear as they are answered.
  const [values, setValues] = useState<Record<string, unknown>>({});

  function pick(next: string) {
    setCode(next);
    setForm(null);
    setValues({});
    if (!next) return;
    startLoading(async () => {
      const loaded = await loadChannelForm(next);
      setForm(loaded);
      if (loaded.ok) setValues(loaded.defaults);
    });
  }

  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));
  const fields = form?.ok ? visibleNow(form.fields, values) : [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> Connect channel
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Connect a channel">
        <form action={formAction} className="space-y-3.5">
          <Field label="Channel">
            <select
              name="code"
              value={code}
              onChange={(e) => pick(e.target.value)}
              className={inputCls}
              required
            >
              <option value="">Choose…</option>
              {available.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          {loading && (
            <p className="flex items-center gap-2 text-[12.5px] text-ink-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking {available.find((c) => c.code === code)?.name} what it needs…
            </p>
          )}

          {form && !form.ok && (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{form.error}</p>
          )}

          {form?.ok && (
            <>
              {fields.length === 0 && (
                <p className="text-[12.5px] text-ink-500">
                  {form.title} needs nothing from you here — everything is handled on the Channex side.
                </p>
              )}
              {fields.map((f) => (
                <Field key={f.name} label={f.title}>
                  {f.type === "select" && f.options ? (
                    <select
                      name={`settings.${f.name}`}
                      value={String(values[f.name] ?? f.default ?? f.options[0] ?? "")}
                      onChange={(e) => set(f.name, e.target.value)}
                      className={inputCls}
                    >
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <input
                      type="checkbox"
                      name={`settings.${f.name}`}
                      checked={values[f.name] === true}
                      onChange={(e) => set(f.name, e.target.checked)}
                      className="h-4 w-4 rounded border-surface-border"
                    />
                  ) : (
                    <input
                      name={`settings.${f.name}`}
                      type={f.type === "number" ? "number" : "text"}
                      value={values[f.name] == null ? "" : String(values[f.name])}
                      onChange={(e) => set(f.name, e.target.value)}
                      className={inputCls}
                      required
                    />
                  )}
                </Field>
              ))}

              {/* Said before they submit, not after it fails. This is the one part of connecting an
                  OTA that no API of ours can do, and finding out about it from an error message is a
                  worse experience than being told up front. */}
              <p className="flex gap-2 rounded-md bg-surface-muted px-3 py-2 text-[12px] text-ink-500">
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  The hotel must also authorise us inside their own {form.title} extranet. We check that
                  when you connect — if it has not been done yet, this will say so.
                </span>
              </p>
            </>
          )}

          {state && !state.ok && (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-[12.5px] font-medium text-danger-600">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !form?.ok}
              className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? "Checking…" : "Test & connect"}
            </button>
          </div>

          {/* Connected is not live, and the button says "connect" — so the difference is stated here
              rather than discovered when no bookings arrive. */}
          <p className="text-[11.5px] text-ink-400">
            The channel is created switched off. Nothing goes on sale until you activate it.
          </p>
        </form>
      </Modal>
    </>
  );
}
