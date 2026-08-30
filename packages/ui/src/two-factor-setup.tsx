"use client";

import { useActionState, useState, useTransition } from "react";
import { ShieldCheck, ShieldOff, Copy, Download } from "lucide-react";
import { OtpInput } from "@revio/ui/otp-input";

/**
 * The enrolment flow, shared by the Operator console and all three hotel products.
 *
 * It was written for the operator and copied nowhere — when hotel accounts needed the same screen it
 * moved here rather than becoming a second copy of a security flow. The server actions arrive as
 * PROPS, which is how `SignOutEverywhere` in this package already works: each app owns its own
 * actions (its own session, its own perimeter) while the screen exists once.
 */
export type TwoFactorState =
  | { step: "idle"; error?: string }
  | { step: "enrolling"; secret: string; uri: string; qrDataUrl: string | null; error?: string }
  | { step: "done"; recoveryCodes: string[] };

export interface TwoFactorActions {
  start: () => Promise<TwoFactorState>;
  confirm: (prev: TwoFactorState | null, fd: FormData) => Promise<TwoFactorState>;
  turnOff: (prev: { error?: string } | null, fd: FormData) => Promise<{ error?: string }>;
}

const inputCls =
  "h-10 w-full rounded-md border border-surface-border bg-white px-3 text-[14px] text-ink-900 outline-none focus:border-brand-600";

/**
 * Turning two-factor authentication on and off for your own account (N4).
 *
 * Three states, and the middle one is the important one: the secret is stored the moment enrolment
 * starts but 2FA is not ON until a code has been verified. So a person who scans nothing, or
 * mistypes, is exactly where they were — able to sign in with a password — rather than locked out
 * of the console that runs the business.
 */
/**
 * Save the recovery codes as a file.
 *
 * A clipboard is not somewhere you keep something for a year — it survives until the next copy, and
 * these are shown exactly once. A plain text file costs nothing (a Blob and an object URL, no
 * dependency, no server round trip) and lands somewhere a person can actually put in a safe, print,
 * or drop into a password manager.
 *
 * Plain text rather than PDF on purpose: it is readable on anything, greppable, and small. The
 * header says what the file is, because a bare list of ten strings found in Downloads next year
 * means nothing to whoever finds it.
 */
function downloadRecoveryCodes(codes: string[], productName: string) {
  const body = [
    `${productName} — two-factor recovery codes`,
    `Generated ${new Date().toISOString().slice(0, 10)}`,
    "",
    "Each code works ONCE. Use one in place of the six-digit code if you lose",
    "access to your authenticator app. Keep this file somewhere other than the",
    "phone the app is on.",
    "",
    ...codes.map((c, i) => `${String(i + 1).padStart(2, " ")}. ${c}`),
    "",
  ].join("\n");

  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `revio-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  // Revoke on the next tick, not immediately: some browsers have not started reading the blob yet
  // when click() returns, and a revoked URL silently produces an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TwoFactorSetup({
  enabled,
  actions,
  /** "Revio Operator" or the hotel product name — used in the recovery-code file header. */
  productName = "Revio",
}: {
  enabled: boolean;
  actions: TwoFactorActions;
  productName?: string;
}) {
  const { start: startTwoFactor, confirm: confirmTwoFactor, turnOff: turnOffTwoFactor } = actions;
  const [state, formAction, pending] = useActionState<TwoFactorState | null, FormData>(confirmTwoFactor, null);
  const [offer, setOffer] = useState<{ secret: string; uri: string; qrDataUrl: string | null } | null>(null);
  const [starting, startTransition] = useTransition();
  const [offState, offAction, offPending] = useActionState<{ error?: string } | null, FormData>(turnOffTwoFactor, null);

  const live = state?.step === "enrolling" ? { secret: state.secret, uri: state.uri, qrDataUrl: state.qrDataUrl } : offer;

  if (state?.step === "done") {
    return (
      <div className="rounded-md border border-success-500 bg-success-50 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-success-700">
          <ShieldCheck className="h-4 w-4" /> Two-factor authentication is on
        </p>
        <p className="mt-2 text-[12.5px] text-ink-700">
          Save these recovery codes somewhere other than the phone with your authenticator app. Each one works
          once, and <span className="font-semibold">this is the only time they are shown</span> — only their
          hashes are kept.
        </p>
        <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
          {state.recoveryCodes.map((c) => (
            <li key={c} className="rounded bg-white px-2 py-1 font-mono text-[13px] tracking-wide text-ink-900">{c}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(state.recoveryCodes.join("\n"))}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-surface-muted"
          >
            <Copy className="h-3.5 w-3.5" /> Copy all
          </button>
          <button
            type="button"
            onClick={() => downloadRecoveryCodes(state.recoveryCodes, productName)}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700 hover:bg-surface-muted"
          >
            <Download className="h-3.5 w-3.5" /> Download .txt
          </button>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-success-700">
          <ShieldCheck className="h-4 w-4" /> Two-factor authentication is on for your account
        </p>
        <form action={offAction} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex-1">
            {/* The password is required for the same reason 2FA exists: an unattended laptop must not
                be enough to remove the protection against an unattended laptop. */}
            <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Your password, to turn it off</span>
            <input name="password" type="password" autoComplete="current-password" className={inputCls} placeholder="••••••••" />
          </label>
          <button
            type="submit"
            disabled={offPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-danger-500 px-3 text-[12.5px] font-semibold text-danger-600 hover:bg-danger-50 disabled:opacity-60"
          >
            <ShieldOff className="h-3.5 w-3.5" /> Turn off
          </button>
        </form>
        {offState?.error && <p role="alert" className="mt-2 text-[12px] font-medium text-danger-600">{offState.error}</p>}
      </div>
    );
  }

  if (!live) {
    return (
      <div>
        <p className="text-[12.5px] text-ink-600">
          This console can read every hotel on the platform, so a password on its own is a single point of failure.
          Two-factor adds a code from your phone.
        </p>
        <button
          type="button"
          disabled={starting}
          onClick={() => startTransition(async () => setOffer(await startTwoFactor().then((s) => (s.step === "enrolling" ? { secret: s.secret, uri: s.uri, qrDataUrl: s.qrDataUrl } : null))))}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> {starting ? "Preparing…" : "Set up two-factor"}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="secret" value={live.secret} />
      <input type="hidden" name="uri" value={live.uri} />
      <p className="text-[12.5px] text-ink-700">
        Scan this with your authenticator app, then enter the code it shows to confirm it works.
      </p>
      <div className="flex flex-wrap items-start gap-4">
        {live.qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={live.qrDataUrl} alt="Two-factor QR code" width={160} height={160} className="rounded border border-surface-border bg-white p-1.5" />
        ) : null}
        <div className="min-w-[180px]">
          <div className="text-[11.5px] font-semibold text-ink-600">Or enter this key by hand</div>
          <code className="mt-1 block break-all rounded bg-surface-sunken px-2 py-1.5 font-mono text-[12px] text-ink-800">{live.secret}</code>
        </div>
      </div>
      <label className="block max-w-[220px]">
        <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Code from your app</span>
        <OtpInput className={inputCls} />
      </label>
      {state?.step === "enrolling" && state.error && (
        <p role="alert" className="text-[12px] font-medium text-danger-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Confirm and turn on"}
      </button>
    </form>
  );
}
