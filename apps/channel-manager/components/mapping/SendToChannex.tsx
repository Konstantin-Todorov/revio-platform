"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Send, XCircle } from "lucide-react";
import { sendProductToChannex, type CatchupOutcome } from "@/lib/actions-connect";

/**
 * The button beside "never sent".
 *
 * The gap was already detected and already described in the hotel's own words — *"Deluxe Suite has
 * never reached your channel manager, so no OTA can see it"* — and there was nothing to press.
 * Provisioning is one-shot, so nothing in the product could create that room on Channex, and the
 * accurate warning was the end of the road. A screen that names a problem and offers no way out
 * reads as software that knows and has decided not to help.
 *
 * One product at a time, named on the button, because "fix everything" is the shape that hides what
 * it actually did — and this writes to a hotel's live distribution.
 */
export function SendToChannex({
  products,
  channelId,
}: {
  products: { id: string; name: string; kind: "roomType" | "ratePlan" }[];
  /** ⚠️ The channel this screen is showing. Every OTA row shares one Channex property id, so the
   *  mapping must be written against the row the hotel is looking at, not the first one found. */
  channelId: string;
}) {
  const [result, setResult] = useState<(CatchupOutcome & { name: string }) | null>(null);
  const [pending, startTransition] = useTransition();

  if (products.length === 0) return null;

  const send = (p: { id: string; name: string; kind: "roomType" | "ratePlan" }) => {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("kind", p.kind === "roomType" ? "room" : "rate");
      fd.set("productId", p.id);
      fd.set("channelId", channelId);
      setResult({ ...(await sendProductToChannex(fd)), name: p.name });
    });
  };

  return (
    <div className="rounded-lg border border-danger-600/25 bg-danger-50/60 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-danger-700">
            {products.length === 1 ? "One product has" : `${products.length} products have`} never reached your channel
            manager
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-600">
            {/*
              Says WHY rather than just what. "Added after this channel was connected" is the fact
              that makes it nobody's mistake, and it is the fact that stops it happening again.
            */}
            They were added after this channel was connected, and setup only sends what exists at the time. No OTA can
            see them until they are sent.
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => send(p)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-800 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                Send {p.name}
                <span className="text-[10px] font-medium uppercase tracking-wide text-white/60">
                  {p.kind === "roomType" ? "room" : "rate"}
                </span>
              </button>
            ))}
          </div>

          {pending && <p className="mt-2 text-[12px] text-ink-500">Sending…</p>}

          {result && !pending && (
            <p
              className={`mt-2 flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ${
                result.ok ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"
              }`}
            >
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              {/*
                The result is the module's own sentence, which keeps created, adopted and skipped
                apart. "Already existed and was linked" is the answer to "why is there no new room on
                Channex", and reporting it as created would produce exactly that question.
              */}
              <span>
                <strong className="font-semibold">{result.name}</strong> — {result.ok ? result.message : result.error}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
