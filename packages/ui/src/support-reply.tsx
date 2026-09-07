"use client";

import { useActionState, useEffect, useRef } from "react";

/**
 * The hotel's half of a support conversation.
 *
 * For its whole first week the ticket centre could only be spoken into from our side: the thread
 * rendered, and there was no input anywhere on the hotel's page. A customer could read what we said
 * and had no way to answer it — their only route back was a new request, arriving as a separate case
 * with none of the history attached. `MyRequests` even rendered "We have your reply" on a branch
 * nothing could reach, because nothing could write a hotel message.
 *
 * Its own client component, and a small one, because `MyRequests` is a server render of rows the
 * database already restricts to the tenant, and that should stay true. This is the only part that
 * needs a bundle.
 *
 * The action comes from the app, never from here: `@revio/ui` holds no perimeter, and each product
 * resolves its own session. Same arrangement as `GetHelp`.
 */

export type SupportReplyResult = { ok: true } | { ok: false; error: string } | null;

export function SupportReply({
  requestId,
  action,
}: {
  requestId: string;
  action: (prev: SupportReplyResult, fd: FormData) => Promise<SupportReplyResult>;
}) {
  const [state, formAction, pending] = useActionState<SupportReplyResult, FormData>(action, null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Clear it only once the server has taken it. Clearing on submit would lose what somebody wrote
  // the one time it matters — when the send failed and they have to try again.
  useEffect(() => {
    if (state?.ok && box.current) box.current.value = "";
  }, [state]);

  return (
    <form action={formAction} className="mt-2.5">
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor={`reply-${requestId}`} className="sr-only">
        Reply to this request
      </label>
      <textarea
        id={`reply-${requestId}`}
        ref={box}
        name="body"
        rows={2}
        required
        placeholder="Add to this request…"
        className="w-full rounded-md border border-surface-border bg-white px-3 py-2 text-[16px] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none sm:text-[13px]"
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md bg-brand-800 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
        {state?.ok === false && (
          <span role="alert" className="text-[12px] font-medium text-danger-600">
            {state.error}
          </span>
        )}
        {state?.ok === true && (
          <span role="status" className="text-[12px] text-success-600">
            Sent — this request is open again.
          </span>
        )}
      </div>
    </form>
  );
}
