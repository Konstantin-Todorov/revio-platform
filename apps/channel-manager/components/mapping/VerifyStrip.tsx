"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw, SearchCheck } from "lucide-react";
import { verifyChannelPublished, type VerifyActionResult } from "@/lib/actions-config";

/**
 * "What is the channel actually publishing?" — the only answer in this product that reads the
 * destination rather than reporting on the attempt.
 *
 * ## Why a button rather than a badge
 *
 * It costs an API call per press, so it is not run on every page load. It is also the check somebody
 * reaches for at exactly one moment — just after mapping, when they want to know it took — and a
 * badge that was true an hour ago would answer a question nobody asked.
 *
 * ## ⚠️ Three outcomes, and "could not look" is one of them
 *
 * A failed read renders as an error, never as "nothing wrong". `data.length ?? 0` reads zero rows
 * for a revoked key exactly as for an empty account, and this screen exists precisely because
 * things that report success without achieving it have cost this project days.
 */
export function VerifyStrip({ channelId, channelName }: { channelId: string; channelName: string }) {
  const [state, formAction, pending] = useActionState<VerifyActionResult | null, FormData>(
    verifyChannelPublished,
    null,
  );

  const money = (m: number | null) => (m == null ? "—" : `€${(m / 100).toLocaleString("en-US")}`);

  return (
    <div className="mb-3 rounded-md border border-surface-border bg-white px-4 py-3">
      <form action={formAction} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input type="hidden" name="channelId" value={channelId} />
        <SearchCheck className="h-4 w-4 shrink-0 text-ink-400" />
        <span className="text-[12.5px] text-ink-600">
          Read back what <strong className="font-semibold text-ink-800">{channelName}</strong> is publishing right now,
          and compare it with what we hold.
        </span>
        <button
          disabled={pending}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-surface-border px-3 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Reading…" : "Verify"}
        </button>
      </form>

      {/* Could not look. Deliberately not rendered as a clean result. */}
      {state?.error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-danger-50 px-2.5 py-2 text-[12.5px] text-danger-700">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      {state?.ok && (
        <div className="mt-2">
          <p
            className={`flex items-start gap-1.5 rounded-md px-2.5 py-2 text-[12.5px] ${
              state.examples && state.examples.length > 0
                ? "bg-warning-50 text-warning-800"
                : "bg-success-50 text-success-700"
            }`}
          >
            {state.examples && state.examples.length > 0 ? (
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {state.headline}
              {state.window && <span className="ml-1 text-ink-400">· {state.window}</span>}
            </span>
          </p>

          {/*
            The findings themselves, in the hotel's own words. "3 mismatches" is a number; "1
            Bedroom · BB Flex — we have €666, they publish €150" is the sentence that makes somebody
            open Mapping and look at the right row.
          */}
          {state.examples && state.examples.length > 0 && (
            <ul className="mt-1.5 space-y-1 pl-6 text-[12px] text-ink-600">
              {state.examples.map((e, i) => (
                <li key={`${e.date}-${i}`} className="tnum">
                  {/*
                    An `unexpected` finding has no room name, because we never sent to that plan —
                    the channel's own id is the only handle it has, and without it the line names
                    nothing somebody could look up. That id is exactly what identifies the room the
                    price wrongly landed on.
                  */}
                  <span className="font-semibold text-ink-800">
                    {e.roomTypeName
                      ? `${e.roomTypeName} · ${e.ratePlanName}`
                      : `Channel rate plan ${e.externalRateId.slice(0, 8)}…`}
                  </span>{" "}
                  {e.date} —{" "}
                  {e.kind === "missing"
                    ? `we have ${money(e.ours)}, they have nothing`
                    : e.kind === "unexpected"
                      ? `they publish ${money(e.theirs)}, we sent nothing`
                      : `we have ${money(e.ours)}, they publish ${money(e.theirs)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
