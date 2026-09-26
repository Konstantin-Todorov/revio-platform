"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Pause, Play, Unplug, PlugZap, RefreshCw, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { channels as channelsDict } from "@/lib/i18n/channels";
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
  const a = translate(channelsDict, useLocale()).actions;
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
            {a.cancel}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className={`rounded-md px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60 ${tone === "danger" ? "bg-danger-600 hover:bg-danger-500" : "bg-brand-800 hover:bg-brand-700"}`}
          >
            {pending ? a.working : confirmLabel}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function PauseChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  const a = translate(channelsDict, useLocale()).actions.pause;
  const [before, bold, after] = a.body(channelName);
  return (
    <ConfirmedAction
      channelId={channelId}
      action={pauseChannelAction}
      icon={<Pause className="h-4 w-4" />}
      label={a.label(channelName)}
      title={a.title(channelName)}
      confirmLabel={a.confirm}
      tone="danger"
      body={
        <>
          {before}<span className="font-semibold text-ink-900">{bold}</span>{after}
        </>
      }
    />
  );
}

export function ResumeChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  const a = translate(channelsDict, useLocale()).actions.resume;
  return (
    <ConfirmedAction
      channelId={channelId}
      action={resumeChannelAction}
      icon={<Play className="h-4 w-4" />}
      label={a.label(channelName)}
      title={a.title(channelName)}
      confirmLabel={a.confirm}
      body={<>{a.body(channelName)}</>}
    />
  );
}

export function DisconnectChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  const a = translate(channelsDict, useLocale()).actions.disconnect;
  const [before, bold, after] = a.body(channelName);
  return (
    <ConfirmedAction
      channelId={channelId}
      action={disconnectChannelAction}
      icon={<Unplug className="h-4 w-4" />}
      label={a.label(channelName)}
      title={a.title(channelName)}
      confirmLabel={a.confirm}
      tone="danger"
      body={
        <>
          {before}<span className="font-semibold text-ink-900">{bold}</span>{after}
        </>
      }
    />
  );
}

export function ReconnectChannelButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  const a = translate(channelsDict, useLocale()).actions.reconnect;
  return (
    <ConfirmedAction
      channelId={channelId}
      action={reconnectChannelAction}
      icon={<PlugZap className="h-4 w-4" />}
      label={a.label(channelName)}
      title={a.title(channelName)}
      confirmLabel={a.confirm}
      body={<>{a.body(channelName)}</>}
    />
  );
}

/** Manual full Sync — recovery push with a visible running state; disabled while it runs. */
export function FullSyncButton({ channelId, channelName }: { channelId: string; channelName: string }) {
  const a = translate(channelsDict, useLocale()).actions.fullSync;
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
      aria-label={a.label(channelName)}
      title={a.title}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-surface-muted hover:text-brand-600 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
    </button>
  );
}
