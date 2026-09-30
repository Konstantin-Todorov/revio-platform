"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { CalendarRange, ChevronRight, Mail, XCircle } from "lucide-react";
import { useGuestKit } from "@/lib/i18n/use-kit";
import { cancelMyBooking, requestManageLink } from "@/lib/actions-manage";

/**
 * "Manage your booking" — the two things a guest comes back to do, the way Booking.com lays them
 * out: change the dates, or cancel. Each says what happens BEFORE it happens: the change page shows
 * the new price first, and the cancel panel states the refund or the fee from the terms they agreed
 * to, so the button never springs a number on anybody.
 *
 * The server decides everything again when the button is pressed; this is only the shape.
 */
export function ManagePanel({
  slug, reference, manageKey, canChange, changeBlockText, canCancel, cancelWords,
}: {
  slug: string;
  reference: string;
  manageKey: string;
  canChange: boolean;
  /** Why dates cannot be changed online — shown instead of the link. */
  changeBlockText: string | null;
  canCancel: boolean;
  /** The money of cancelling, already in words. */
  cancelWords: string;
}) {
  const { s } = useGuestKit();
  const m = s.manage;
  const [confirming, setConfirming] = useState(false);
  const changeHref = `/${slug}/booking/${reference}/change?k=${encodeURIComponent(manageKey)}`;

  return (
    <section className="mt-6" aria-labelledby="manage-title">
      <h2 id="manage-title" className="display text-[1.2rem]">{m.title}</h2>
      <div className="card mt-4 divide-y overflow-hidden" style={{ borderColor: "hsl(var(--line))" }}>
        {canChange ? (
          <a href={changeHref} className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-[hsl(var(--surface-sunk))]" style={{ borderColor: "hsl(var(--line))" }}>
            <Icon><CalendarRange size={17} aria-hidden /></Icon>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold">{m.changeDates}</span>
              <span className="block text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>{m.changeDatesSub}</span>
            </span>
            <ChevronRight size={17} aria-hidden style={{ color: "hsl(var(--ink-faint))" }} />
          </a>
        ) : changeBlockText ? (
          <div className="flex items-center gap-3.5 px-5 py-4" style={{ borderColor: "hsl(var(--line))" }}>
            <Icon muted><CalendarRange size={17} aria-hidden /></Icon>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold" style={{ color: "hsl(var(--ink-soft))" }}>{m.changeDates}</span>
              <span className="block text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>{changeBlockText}</span>
            </span>
          </div>
        ) : null}

        {canCancel && (
          <div style={{ borderColor: "hsl(var(--line))" }}>
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)}
                      className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-[hsl(var(--surface-sunk))]">
                <Icon danger><XCircle size={17} aria-hidden /></Icon>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">{m.cancel}</span>
                  <span className="block text-[12.5px]" style={{ color: "hsl(var(--ink-faint))" }}>{m.cancelSub}</span>
                </span>
                <ChevronRight size={17} aria-hidden style={{ color: "hsl(var(--ink-faint))" }} />
              </button>
            ) : (
              <form action={cancelMyBooking} className="px-5 py-4">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="reference" value={reference} />
                <input type="hidden" name="k" value={manageKey} />
                <p className="text-[14.5px] font-semibold">{m.cancel}</p>
                <p className="mt-1.5 rounded-lg px-3 py-2.5 text-[13.5px] leading-relaxed"
                   style={{ backgroundColor: "hsl(var(--caution) / 0.08)", color: "hsl(var(--ink))" }}>
                  {cancelWords}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CancelButton label={m.cancelConfirm} pending={m.cancelling} />
                  <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost px-4">{m.keep}</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CancelButton({ label, pending }: { label: string; pending: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} className="btn px-4 font-semibold"
            style={{ backgroundColor: "hsl(var(--caution))", color: "white" }}>
      {busy ? pending : label}
    </button>
  );
}

function Icon({ children, muted, danger }: { children: React.ReactNode; muted?: boolean; danger?: boolean }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: danger ? "hsl(var(--caution) / 0.1)" : muted ? "hsl(var(--surface-sunk))" : "hsl(var(--brand-wash))",
            color: danger ? "hsl(var(--caution))" : muted ? "hsl(var(--ink-faint))" : "hsl(var(--brand-text))",
          }}>
      {children}
    </span>
  );
}

/**
 * No key in the link — somebody opened the booking by its reference. Offer the private link by
 * email instead of the buttons: the reference is printed on paper; the inbox is the guest's.
 */
export function AskManageLink({ slug, reference }: { slug: string; reference: string }) {
  const { s } = useGuestKit();
  const m = s.manage;
  const [state, setState] = useState<"idle" | "sent" | "limited">("idle");
  const [pending, start] = useTransition();
  return (
    <section className="mt-6" aria-labelledby="ask-title">
      <h2 id="ask-title" className="display text-[1.2rem]">{m.askTitle}</h2>
      <div className="card mt-4 p-5">
        <p className="flex items-start gap-2 text-[13.5px]" style={{ color: "hsl(var(--ink-soft))" }}>
          <Mail size={15} aria-hidden className="mt-0.5 shrink-0" style={{ color: "hsl(var(--brand-text))" }} />
          {m.askBody}
        </p>
        {state === "sent" ? (
          <p className="mt-3 text-[13.5px] font-semibold" style={{ color: "hsl(var(--positive))" }} role="status">{m.askSent}</p>
        ) : (
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            action={(fd) => start(async () => {
              const r = await requestManageLink(fd);
              setState(r.ok ? "sent" : "limited");
            })}
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="reference" value={reference} />
            <label className="sr-only" htmlFor="manage-email">{m.askEmail}</label>
            <input id="manage-email" name="email" type="email" required autoComplete="email"
                   placeholder={m.askEmail}
                   className="min-w-0 flex-1 rounded-[var(--r-sm)] border px-3 py-2.5 text-[14.5px] outline-none"
                   style={{ borderColor: "hsl(var(--line-strong))", backgroundColor: "hsl(var(--surface))" }} />
            <button type="submit" disabled={pending} className="btn btn-brand shrink-0 px-5">
              {pending ? m.askSending : m.askSend}
            </button>
          </form>
        )}
        {state === "limited" && (
          <p className="mt-2 text-[12.5px]" style={{ color: "hsl(var(--caution))" }} role="alert">{m.askLimited}</p>
        )}
      </div>
    </section>
  );
}
