"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw, SearchCheck } from "lucide-react";
import { verifyChannelPublished, type VerifyActionResult } from "@/lib/actions-config";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { mapping as mappingDict } from "@/lib/i18n/mapping";

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

  const locale = useLocale();
  const v = translate(mappingDict, locale).verify;
  const money = (m: number | null) =>
    m == null ? "—" : locale === "bg" ? `${(m / 100).toLocaleString("bg-BG")} €` : `€${(m / 100).toLocaleString("en-US")}`;

  return (
    <div id="verify" className="mb-3 scroll-mt-4 rounded-md border border-surface-border bg-white px-4 py-3">
      <form action={formAction} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input type="hidden" name="channelId" value={channelId} />
        <SearchCheck className="h-4 w-4 shrink-0 text-ink-400" />
        <span className="text-[12.5px] text-ink-600">
          {v.lead[0]}<strong className="font-semibold text-ink-800">{channelName}</strong>{v.lead[1]}
        </span>
        <button
          disabled={pending}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-surface-border px-3 text-[12px] font-semibold text-ink-700 transition-colors hover:bg-surface-muted disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? v.reading : v.button}
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
                      : e.channelPlanName
                        ? v.plan(channelName, e.channelPlanName)
                        : v.anonymous(e.externalRateId.slice(0, 8))}
                  </span>{" "}
                  {e.date} —{" "}
                  {e.kind === "missing"
                    ? v.missing(money(e.ours))
                    : e.kind === "unexpected"
                      ? v.unexpected(money(e.theirs))
                      : v.mismatch(money(e.ours), money(e.theirs))}
                  {/* The cause, when it is knowable — a derived plan ignores what we send. */}
                  {e.kind === "mismatch" && e.derivedFrom && (
                    <span className="block pl-3 text-ink-500">
                      {v.derived(channelName, e.derivedFrom)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* A plan the channel sells that nobody in Revio controls — the price guests see there is not ours to change. */}
          {state.examples?.some((e) => e.kind === "unexpected") && (
            <p className="mt-1.5 pl-6 text-[12px] text-ink-500">
              {v.unmanaged(channelName)}
            </p>
          )}

          {/* The room counts — what a guest on an OTA sees first: is there a room at all? */}
          {state.rooms && (
            <p
              className={`mt-2 flex items-start gap-1.5 rounded-md px-2.5 py-2 text-[12.5px] ${
                !state.rooms.ok
                  ? "bg-danger-50 text-danger-700"
                  : state.rooms.examples && state.rooms.examples.length > 0
                    ? "bg-warning-50 text-warning-800"
                    : "bg-success-50 text-success-700"
              }`}
            >
              {state.rooms.ok && !(state.rooms.examples && state.rooms.examples.length > 0) ? (
                <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              )}
              <span>{v.rooms((state.rooms.ok ? state.rooms.headline : state.rooms.error) ?? "")}</span>
            </p>
          )}
          {state.rooms?.examples && state.rooms.examples.length > 0 && (
            <ul className="mt-1.5 space-y-1 pl-6 text-[12px] text-ink-600">
              {state.rooms.examples.map((e, i) => (
                <li key={`${e.roomTypeName}-${e.date}-${i}`} className="tnum">
                  <span className="font-semibold text-ink-800">{e.roomTypeName}</span> {e.date} — {v.roomLine(e.ours, e.closedByStopSell, e.theirs)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
