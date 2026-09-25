"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Unplug, PlugZap } from "lucide-react";
import { setCmConnection } from "@/lib/actions-settings";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { distribution as distributionDict } from "@/lib/i18n/distribution";

/** Pause / disconnect at the CM-CONNECTION level (spec §3.8) — high-consequence (stops all
 * distribution), so both require an explicit confirmation. Mapping stays dormant throughout. */
function ConfirmedCmAction({
  action, icon, label, title, body, confirmLabel, tone = "brand",
}: {
  action: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "brand" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const a = translate(distributionDict, useLocale()).actions;
  const run = () => {
    const fd = new FormData();
    fd.set("cmAction", action);
    start(async () => {
      await setCmConnection(fd);
      setOpen(false);
    });
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-surface-muted ${tone === "danger" ? "text-danger-600" : "text-ink-600"}`}
      >
        {icon} {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
            <div className="mt-2 text-[13px] text-ink-600">{body}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">{a.cancel}</button>
              <button
                type="button"
                onClick={run}
                disabled={pending}
                className={`rounded-md px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60 ${tone === "danger" ? "bg-danger-600 hover:bg-danger-500" : "bg-brand-800 hover:bg-brand-700"}`}
              >
                {pending ? a.working : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CmConnectionActions({ status }: { status: string }) {
  const a = translate(distributionDict, useLocale()).actions;
  if (status === "disconnected") {
    return (
      <ConfirmedCmAction
        action="reconnect"
        icon={<PlugZap className="h-3.5 w-3.5" />}
        label={a.reconnect}
        title={a.reconnectTitle}
        confirmLabel={a.reconnect}
        body={<>{a.reconnectBody}</>}
      />
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      {status === "paused" ? (
        <ConfirmedCmAction
          action="resume"
          icon={<Play className="h-3.5 w-3.5" />}
          label={a.resumeLabel}
          title={a.resumeTitle}
          confirmLabel={a.resume}
          body={<>{a.resumeBody}</>}
        />
      ) : (
        <ConfirmedCmAction
          action="pause"
          icon={<Pause className="h-3.5 w-3.5" />}
          label={a.pause}
          title={a.pauseTitle}
          confirmLabel={a.pauseConfirm}
          tone="danger"
          body={<>{a.pauseBody}</>}
        />
      )}
      <ConfirmedCmAction
        action="disconnect"
        icon={<Unplug className="h-3.5 w-3.5" />}
        label={a.disconnect}
        title={a.disconnectTitle}
        confirmLabel={a.disconnect}
        tone="danger"
        body={
          <>
            {a.disconnectLead}<span className="font-semibold">{a.preserved}</span>{a.disconnectTail}
          </>
        }
      />
    </div>
  );
}
