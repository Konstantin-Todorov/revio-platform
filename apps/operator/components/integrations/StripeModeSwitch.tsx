import { AlertTriangle, FlaskConical, Zap } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { setStripeMode } from "@/lib/actions-integrations";
import type { StripeMode } from "@/lib/stripe-key";

/**
 * Which environment payments use — the single most consequential switch in this console.
 *
 * ## Why it exists at all
 *
 * It did not, and that was a defect. The mode was **derived**: a live key that had checked out ok
 * meant "we are live". So pasting a live key to see whether the connection worked — the ordinary
 * reason anyone pastes one — silently made the next payment link charge a real card.
 *
 * The screen already refused a live key in the sandbox field on the grounds that *"mode is chosen by
 * a person and validated against the key, never inferred from it"*. The selection one layer up then
 * inferred it from exactly the same evidence.
 *
 * ## Why it looks like this
 *
 * Live is stated in red, in words, at the top of the page, and it says what it *does* rather than
 * what it is called — "every payment link charges a real card" beats a badge reading LIVE. A person
 * arriving here after a week away should not have to work out which environment they are in; that is
 * the question this card exists to answer before it is asked.
 */
export function StripeModeSwitch({
  mode,
  problem,
  canEdit,
  liveReady,
}: {
  mode: StripeMode;
  /** A chosen mode that cannot currently be honoured — set to live with no working live key. */
  problem: string | null;
  canEdit: boolean;
  liveReady: boolean;
}) {
  const live = mode === "live";

  return (
    <Card className={`mb-4 p-4 ${live ? "border-danger-600/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
              live ? "bg-danger-50 text-danger-600" : "bg-surface-sunken text-ink-500"
            }`}
          >
            {live ? <Zap className="h-[18px] w-[18px]" /> : <FlaskConical className="h-[18px] w-[18px]" />}
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-ink-900">
              {live ? "Payments are LIVE" : "Payments are in sandbox"}
            </h3>
            {/* What it does, not what it is called. */}
            <p className="mt-1 max-w-[64ch] text-[12px] leading-relaxed text-ink-500">
              {live
                ? "Every payment link created from here on charges a real card and moves real money."
                : "Nothing created here can charge anybody. Payment links use Stripe's test cards, and an invoice paid in sandbox is marked paid without money moving."}
            </p>
          </div>
        </div>

        {canEdit && (
          <form action={setStripeMode}>
            <input type="hidden" name="mode" value={live ? "test" : "live"} />
            <button
              type="submit"
              disabled={!live && !liveReady}
              title={!live && !liveReady ? "Add and check a live key first" : undefined}
              className={`rounded-md px-3 py-2 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                live
                  ? "border border-surface-border text-ink-700 hover:bg-surface-muted"
                  : "bg-danger-600 text-white hover:bg-danger-700"
              }`}
            >
              {live ? "Switch back to sandbox" : "Go live"}
            </button>
          </form>
        )}
      </div>

      {/*
        * A chosen mode that cannot be honoured.
        *
        * The choice and the credential are separate facts and either can move without the other — a
        * key removed, rolled at Stripe, or lost in a secret rotation. A console set to live with no
        * working live key looks entirely normal and quietly takes no money.
        */}
      {problem && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-warning-50 px-3 py-2 text-[12px] leading-relaxed text-warning-700">
          <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" />
          {problem}
        </p>
      )}

      {!live && !liveReady && canEdit && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
          Going live needs a live key that has been stored <em>and</em> checked successfully. That is
          a precondition on a decision you make — not the old behaviour, where storing one made the
          decision for you.
        </p>
      )}
    </Card>
  );
}
