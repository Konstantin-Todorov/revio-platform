import {
  reviolinkSetup,
  reviocrsSetup,
  reviopmsSetup,
  type ProductName,
  type SetupFacts,
  type SetupProgress,
} from "@revio/core";

/**
 * What a client has actually set up, per product, from our side of the glass.
 *
 * ## The rule this file exists to obey
 *
 * **The operator sees exactly what the hotel sees.** Every number below comes from the same
 * `reviolinkSetup` / `reviocrsSetup` / `reviopmsSetup` in `@revio/core` that renders the hotel's own
 * checklist. A second definition here would drift within a month, and the first symptom would be an
 * operator ringing a hotel about a step that is not on their screen — which is worse than no visibility
 * at all, because it costs the customer's confidence rather than only our time.
 *
 * ## What is deliberately NOT claimed
 *
 * We do not record *when* each step was completed, so this cannot honestly say "stuck on step 2 for
 * nine days". It says how long the client has existed and how far they have got. Inventing a
 * per-step clock would mean either a schema change nobody asked for, or a guess presented as a fact.
 */

export type ProductKey = "cm" | "crs" | "pms";

export interface Entitlements {
  channelManager: boolean;
  reservation: boolean;
  pms: boolean;
}

export interface ProductSetup {
  key: ProductKey;
  /** The name the hotel sees, so a call uses their vocabulary. */
  name: string;
  progress: SetupProgress;
}

export interface ClientSetup {
  products: ProductSetup[];
  /** Steps finished across every product they bought. */
  done: number;
  total: number;
  /** True once every product they own is fully set up. */
  complete: boolean;
  /** Products bought but not yet finished — what a call would be about. */
  incomplete: ProductSetup[];
  /**
   * The single most useful sentence for a call sheet, or null when there is nothing to say.
   * Deliberately their language ("Add your room types"), not ours ("roomTypes = 0").
   */
  nextStep: { product: string; title: string } | null;
}

/**
 * Fold the shared setup definitions over the products this client actually bought.
 *
 * A product they do not own is absent rather than shown at 0% — reporting RevioPMS as "0 of 5" for a
 * hotel that never bought it turns the console into a wall of red for clients who are perfectly fine,
 * which is the failure the attention feed was built to avoid.
 */
export function clientSetup(facts: SetupFacts, entitlements: Entitlements): ClientSetup {
  // Each product is asked the question from its own point of view: "which OTHER products does this
  // hotel run?" — the same input the hotel's own dashboard supplies, so the console sees the same
  // "already set up in RevioLink" the customer does.
  const owned: [boolean, ProductName][] = [
    [entitlements.channelManager, "RevioLink"],
    [entitlements.reservation, "RevioCRS"],
    [entitlements.pms, "RevioPMS"],
  ];
  const factsFor = (self: ProductName): SetupFacts => ({
    ...facts,
    alsoRuns: owned.filter(([has, name]) => has && name !== self).map(([, name]) => name),
  });

  const products: ProductSetup[] = [];
  if (entitlements.channelManager) products.push({ key: "cm", name: "RevioLink", progress: reviolinkSetup(factsFor("RevioLink")) });
  if (entitlements.reservation) products.push({ key: "crs", name: "RevioCRS", progress: reviocrsSetup(factsFor("RevioCRS")) });
  if (entitlements.pms) products.push({ key: "pms", name: "RevioPMS", progress: reviopmsSetup(factsFor("RevioPMS")) });

  const done = products.reduce((n, p) => n + p.progress.done, 0);
  const total = products.reduce((n, p) => n + p.progress.total, 0);
  const incomplete = products.filter((p) => !p.progress.complete);

  // The first unfinished step of the least-finished product: where a call should start.
  const worst = [...incomplete].sort((a, b) => a.progress.done - b.progress.done)[0];
  const nextStep = worst?.progress.next ? { product: worst.name, title: worst.progress.next.title } : null;

  return {
    products,
    done,
    total,
    complete: products.length > 0 && incomplete.length === 0,
    incomplete,
    nextStep,
  };
}

/** Days since a date, floored. Exported so the caller and the tests agree on "how old". */
export function daysSince(from: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Is this worth a phone call?
 *
 * Two conditions, both required. Something is unfinished, AND the client has had a fair chance —
 * everything is unfinished on day one, and flagging that is how a console teaches people to ignore it.
 * The 14-day grace matches `GRACE_DAYS` in `attention.ts` on purpose; two different definitions of
 * "new client" across two screens of the same console is a bug waiting to be argued about.
 */
export const SETUP_GRACE_DAYS = 14;

export function setupStalled(setup: ClientSetup, ageDays: number): boolean {
  return !setup.complete && setup.products.length > 0 && ageDays > SETUP_GRACE_DAYS;
}
