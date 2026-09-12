import { ArrowRight, Clock, Lock, MailCheck } from "lucide-react";
import { productAccessCopy, type ProductAccessState } from "@revio/core";

/**
 * The screen a hotel meets when it opens a product it cannot currently use.
 *
 * ⚠️ **One component, used by all three apps.** It was three copies of the same sentence, which is
 * how all three came to say "this hotel hasn't subscribed" to a hotel whose trial had just ended —
 * fixing it in one app would have left the other two lying.
 *
 * The job is not to explain a licence. It is to make sure the most valuable visitor we have — a
 * hotel that used the product for thirty days and came back — finds a way forward instead of a
 * full stop. So, in order: what happened and when, that their data is untouched, one thing to press,
 * and the doors that still open.
 */
export function ProductLocked({
  state,
  hotelName,
  fmtDate,
  /** Server-resolved hrefs for the products they can still open. */
  hrefFor,
  /** Rendered under the message — the app supplies its own form, since only it has the action. */
  action,
}: {
  state: ProductAccessState;
  hotelName: string;
  fmtDate: (d: Date) => string;
  hrefFor: (key: string) => string;
  action?: React.ReactNode;
}) {
  const copy = productAccessCopy(state, hotelName, fmtDate);
  const ended = state.reason === "trial-ended";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-6 py-10">
      <div className="w-full max-w-lg text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-xl ${
            ended ? "bg-brand-50 text-brand-700" : "bg-warning-50 text-warning-600"
          }`}
        >
          {ended ? <Clock className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
        </div>

        <h1 className="mt-4 text-[20px] font-bold tracking-tight text-ink-900">{copy.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-600">{copy.body}</p>

        {/*
          Already asked, and waiting on us. Saying so is the difference between "we heard you" and a
          button they press again tomorrow wondering whether the first one worked.
        */}
        {/*
          ⚠️ The offer above has to be reachable, or it is worse than not making it.
          "Try it free for 30 days" with nothing to press is the dead end this screen exists to
          remove. The start-trial flow lives inside `(protected)`, so it cannot be hosted by the
          product they are locked out of — this points at one they CAN open, which is why
          `stillOpen` is required for it. With no other product there is nowhere to host it, and
          the honest action is the support address below.
        */}
        {state.canStartTrial && state.stillOpen.length > 0 && (
          <div className="mt-5 flex justify-center">
            <a
              href={`${hrefFor(state.stillOpen[0]!.key)}/start-trial/${state.product.key}`}
              className="flex h-10 items-center gap-2 rounded-md bg-brand-800 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Start your free trial <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}

        {state.keepRequested ? (
          <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-1.5 rounded-md bg-success-50 px-3 py-2 text-[12.5px] font-semibold text-success-700">
            <MailCheck className="h-4 w-4 shrink-0" />
            You've asked to keep {state.product.name} — we'll be in touch shortly.
          </p>
        ) : (
          action && <div className="mt-5 flex justify-center">{action}</div>
        )}

        {/*
          ⚠️ Never a dead end. A trial ends per product, so a hotel locked out of one is very often
          still working in another every morning — and a wall with no doors is how somebody decides
          the whole platform is broken rather than that one licence lapsed.
        */}
        {state.stillOpen.length > 0 && (
          <div className="mt-7 border-t border-surface-border pt-5 text-left">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Still yours, and open right now
            </p>
            <ul className="mx-auto mt-2.5 max-w-sm space-y-1.5">
              {state.stillOpen.map((p) => (
                <li key={p.key}>
                  <a
                    href={hrefFor(p.key)}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-white px-3 py-2.5 text-[13px] transition-colors hover:border-brand-600/40"
                  >
                    <span>
                      <span className="font-semibold text-brand-700">{p.name}</span>
                      <span className="ml-2 text-ink-500">{p.tagline}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-[12px] text-ink-400">
          Questions?{" "}
          <a href="mailto:support@reviosoft.app" className="font-semibold text-brand-700 hover:underline">
            support@reviosoft.app
          </a>
        </p>
      </div>
    </div>
  );
}
