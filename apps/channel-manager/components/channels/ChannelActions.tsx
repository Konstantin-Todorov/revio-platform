"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Pause, Play, Unplug, PlugZap, RefreshCw, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  pauseChannelAction, resumeChannelAction, disconnectChannelAction, reconnectChannelAction, resyncChannel,
} from "@/lib/actions-config";

/**
 * The three channel quick actions (spec §3.5). Pause/Disconnect are high-consequence — they close
 * revenue on the channel — so both require an explicit confirmation. Sync shows a running state and
 * can't stack. All of them land in the Sync Center audit trail attributed to the channel.
 */
function ConfirmedAction({
  channelId, action, icon, label, title, body, confirmLabel, tone = "brand",
}: {
  channelId: string;
  action: (fd: FormData) => Promise<void>;
  icon: ReactNode;
  label: string;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "brand" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = () => {
    const fd = new FormData();
    fd.set("channelId", channelId);
    start(async () => {
      await action(fd);
      setOpen(false);
    });
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={`flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted ${tone === "danger" ? "hover:text-danger-600" : "hover:text-brand-600"}`}
      >
        {icon}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="text-[13px] text-ink-600">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-surface-border px-3.5 py-2 text-[13px] font-semibold text-ink-600 hover:bg-surface-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className={`rounded-md px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60 ${tone === "danger" ? "bg-danger-600 hover:bg-danger-500" : "bg-brand-800 hover:bg-brand-700"}`}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function PauseChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  return (
    <ConfirmedAction
      channelId={channelId}
      action={pauseChannelAction}
      icon={<Pause className="h-4 w-4" />}
      label={`Pause ${channelName}`}
      title={`Pause ${channelName}?`}
      confirmLabel="Pause channel"
      tone="danger"
      body={
        <>
          This closes <span className="font-semibold text-ink-900">all dates on {channelName}</span> with a reversible
          stop-sell overlay — no bookings can arrive until you resume. Your rates and availability stay untouched, and
          other channels keep selling from the shared pool. Resume restores the exact prior state instantly.
        </>
      }
    />
  );
}

export function ResumeChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  return (
    <ConfirmedAction
      channelId={channelId}
      action={resumeChannelAction}
      icon={<Play className="h-4 w-4" />}
      label={`Resume ${channelName}`}
      title={`Resume ${channelName}?`}
      confirmLabel="Resume selling"
      body={<>Reopens {channelName} by re-pushing your live availability, rates and restrictions (365 days) — the exact state from before the pause.</>}
    />
  );
}

export function DisconnectChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  return (
    <ConfirmedAction
      channelId={channelId}
      action={disconnectChannelAction}
      icon={<Unplug className="h-4 w-4" />}
      label={`Disconnect ${channelName}`}
      title={`Disconnect ${channelName}?`}
      confirmLabel="Disconnect"
      tone="danger"
      body={
        <>
          Stops syncing and closes {channelName} out so it isn’t left selling on stale rates. Your mapping is kept
          <span className="font-semibold text-ink-900"> dormant</span> — reconnecting later never forces a re-map — and
          reservations already imported from {channelName} are not touched.
        </>
      }
    />
  );
}

export function ReconnectChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  return (
    <ConfirmedAction
      channelId={channelId}
      action={reconnectChannelAction}
      icon={<PlugZap className="h-4 w-4" />}
      label={`Reconnect ${channelName}`}
      title={`Reconnect ${channelName}?`}
      confirmLabel="Reconnect"
      body={<>Resumes distribution on {channelName} using the preserved mapping, then pushes a full 365-day sync.</>}
    />
  );
}

/** Manual full Sync — recovery push with a visible running state; disabled while it runs. */
export function FullSyncButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [pending, start] = useTransition();
  const run = () => {
    const fd = new FormData();
    fd.set("channelId", channelId);
    start(async () => {
      await resyncChannel(fd);
    });
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      aria-label={`Full sync ${channelName}`}
      title="Full sync — push the next 365 days of ARI to force this channel back into agreement"
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
    </button>
  );
}
