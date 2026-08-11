/**
 * How a channel actually reaches the outside world, said in the hotel's language.
 *
 * The stored values (`mock` · `channex_sandbox` · `channex_prod`) are ours; they describe which
 * adapter is wired up. Four screens across three apps were each translating them by hand, and each
 * one printed some version of "Mock (demo)" — which tells a paying hotel it has been given a toy.
 *
 * What the hotel needs to know is narrower and more useful: **is anything actually leaving this
 * system?** `mock` means no. That is a normal, honest state during setup, not a lesser product, so
 * it is named for what it does rather than for the adapter behind it.
 */

/** The connectivity modes a Channel can be in (`Channel.connectivityMode`). */
export type ConnectivityMode = "mock" | "channex_sandbox" | "channex_prod";

const LABELS: Record<ConnectivityMode, string> = {
  mock: "Test connection",
  channex_sandbox: "Channex — test",
  channex_prod: "Channex",
};

/**
 * A short label for a channel's connectivity mode. Unknown values are returned readably rather than
 * dropped, so a mode added to the schema and not yet added here degrades to "some_new_mode" instead
 * of vanishing from the screen.
 */
export function connectivityModeLabel(mode: string): string {
  return LABELS[mode as ConnectivityMode] ?? mode.replace(/_/g, " ");
}

/** True when nothing this channel does leaves the platform — used to explain, never to scold. */
export function isTestConnection(mode: string): boolean {
  return mode === "mock";
}
