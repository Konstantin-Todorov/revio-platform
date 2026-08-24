/** Instrumentation for @revio/operator. */

/**
 * Every unhandled server error, recorded once per distinct fault.
 *
 * Next calls this for errors it has already caught and turned into a 500 — the request is lost
 * either way, and the only question is whether anyone finds out. Until now nobody did: it went to a
 * container log that rotates, and the detection mechanism was a hotel ringing to say the screen went
 * white.
 *
 * `recordAppError` never throws — it runs inside the error handler, and a reporter that can throw
 * turns a handled 500 into a crash at exactly the wrong moment. It aggregates by signature, so a bug
 * on a hot route is one row with a count rather than ten thousand rows burying the next bug.
 */
export async function onRequestError(err: unknown, request: { path?: string }): Promise<void> {
  // Node only, and imported through `@revio/db/errors` rather than the main barrel. Instrumentation
  // is bundled for the EDGE runtime too, and the barrel reaches `node:crypto` via the connectivity
  // cipher, the auth tokens and the job lease — none of which the edge bundler can resolve, so the
  // build fails outright. The runtime guard alone is not enough: webpack follows the dynamic import
  // whether or not the branch runs. The subpath keeps `node:crypto` out of the graph entirely.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordAppError } = await import("@revio/db/errors");
  await recordAppError({ service: "operator", error: err, route: request?.path ?? null });
}
