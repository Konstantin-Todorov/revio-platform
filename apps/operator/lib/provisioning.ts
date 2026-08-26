import type { Entitlements } from "./onboarding.js";

/**
 * What **we** still have to do for a client — as opposed to what the hotel still has to do.
 *
 * ## The hole this closes
 *
 * `onboarding.ts` answers "how far has the hotel got with its own setup", folded over the products
 * they bought. It is honest and it is not enough, because it measures things the hotel does *inside*
 * a product: rooms, rates, taxes, staff. Every one of those lives in the shared core.
 *
 * Which produces this failure, and it reports green while it happens:
 *
 *   A hotel runs RevioCRS. Rooms, rate plans, prices, taxes — all done, checklist complete. They buy
 *   RevioLink. The entitlement is a checkbox in the console, so it flips instantly and the app
 *   appears in their switcher. `clientSetup` re-reads the same shared rows, finds them all satisfied,
 *   and reports the new product **100% set up**. But there is no Channex property, no credential and
 *   no channel — RevioLink is an empty shell pointing at nothing, and the console is telling us the
 *   client is fine.
 *
 * That is the "buy one, add the others, no migration" promise at its most exposed. The promise is
 * true about *data* — and RevioLink is the one product that also needs something provisioned
 * OUTSIDE our database, which no amount of shared schema can inherit.
 *
 * ## Why it is a separate module and a separate list
 *
 * Because the owner is different. A hotel step is a call: *"have you added your rate plans yet?"* A
 * provisioning step is ours to do and the hotel cannot do it, cannot see it, and should never be
 * asked about it. Merging them into one progress bar would put work we owe the customer into a list
 * we chase the customer about.
 *
 * ## The seven combinations, and the only one that changes the answer
 *
 * There are seven ways to buy the platform. Six of them provision identically, because CRS and PMS
 * need nothing outside our own database — the shared core IS their integration. **Only
 * `channelManager` requires external provisioning.** So this file does not enumerate combinations; it
 * asks one question per client and lets the entitlement decide. Enumerating them would be seven
 * branches that agree, and the eighth would be added wrong.
 *
 * Pure. The caller reads the facts; this decides what they mean.
 */

export type ProvisioningStepKey =
  | "channex_credential"
  | "channex_property"
  | "channel_connected"
  | "channel_activated";

export type Severity = "blocking" | "soon" | "fyi";

export interface ProvisioningStep {
  key: ProvisioningStepKey;
  /** What we have to do, in the words an operator would use on a call. */
  title: string;
  /** Why it matters — shown because a step with no stated cost gets deferred forever. */
  why: string;
  severity: Severity;
  /** The command or screen that does it, when there is one. */
  how?: string;
}

export interface ProvisioningFacts {
  entitlements: Entitlements;
  /** A stored Channex API credential for this tenant, in either mode. */
  hasChannexCredential: boolean;
  /** Channels whose `externalPropertyId` is set — i.e. a Channex property exists and is mapped. */
  channelsWithExternalProperty: number;
  /** Channels in `connected` status. */
  channelsConnected: number;
  /** Channels actually pushing — the only state that means a room is on sale. */
  channelsLive: number;
  /** Demo tenants are provisioned deliberately differently; never chase them. */
  isDemo: boolean;
}

export interface ProvisioningState {
  steps: ProvisioningStep[];
  /** True when nothing is outstanding on our side. */
  ready: boolean;
  /**
   * The one sentence for a status column. `null` when there is nothing to say — which for a
   * CRS-only or PMS-only client is the normal, permanent answer.
   */
  headline: string | null;
}

export function provisioningState(facts: ProvisioningFacts): ProvisioningState {
  const steps: ProvisioningStep[] = [];

  // A demo tenant is provisioned by hand, on the sandbox, on purpose. Listing work against it would
  // put two permanent rows in a feed whose whole value is that it is usually empty.
  if (facts.isDemo) return { steps, ready: true, headline: null };

  /*
   * The single branch. RevioCRS and RevioPMS are complete the moment the entitlement is set: their
   * integration is the shared database, which already exists. There is genuinely nothing for us to do
   * — and saying so explicitly is the point, because an empty list here must read as "correct", not
   * as "not checked yet".
   */
  if (facts.entitlements.channelManager) {
    if (!facts.hasChannexCredential) {
      steps.push({
        key: "channex_credential",
        title: "Store this hotel's Channex credential",
        why: "Without it every rate push fails to decrypt, and the hotel sees a Sync Center full of errors it cannot fix.",
        severity: "blocking",
        how: "Operator → Connectivity → this client",
      });
    }
    if (facts.channelsWithExternalProperty === 0) {
      steps.push({
        key: "channex_property",
        title: "Create and map the Channex property",
        why: "RevioLink has nothing to push to until the property, room types and rate plans exist on the Channex side.",
        severity: "blocking",
        how: "pnpm --filter @revio/connectivity channex:onboard --tenant <slug>",
      });
    }
    if (facts.channelsConnected === 0) {
      steps.push({
        key: "channel_connected",
        title: "Connect at least one OTA",
        why: "The hotel is paying for distribution and is distributing to nowhere.",
        severity: facts.channelsWithExternalProperty > 0 ? "blocking" : "soon",
        how: "RevioLink → Channels → Connect a channel",
      });
    } else if (facts.channelsLive === 0) {
      steps.push({
        key: "channel_activated",
        title: "Activate the connected channel",
        why: "Connected is not live. Rooms are not on sale until the channel is activated, and this is also when Channex starts billing us for the property.",
        severity: "blocking",
        how: "RevioLink → Channels",
      });
    }
  }

  const blocking = steps.filter((s) => s.severity === "blocking");
  return {
    steps,
    ready: steps.length === 0,
    headline:
      steps.length === 0
        ? null
        : blocking.length > 0
          ? blocking[0]!.title
          : steps[0]!.title,
  };
}

/**
 * Did a product get switched on without the provisioning it needs?
 *
 * The specific alarm for the scenario in the header: an entitlement flipped in the console while the
 * thing that makes it work does not exist. Separated from the step list because it is not a task, it
 * is a **wrong state** — the customer can already open a product that cannot function, and the
 * urgency is different from "there is setup left to do".
 */
export function soldButNotProvisioned(facts: ProvisioningFacts): string | null {
  if (facts.isDemo) return null;
  if (!facts.entitlements.channelManager) return null;
  if (facts.channelsWithExternalProperty > 0) return null;
  return "RevioLink is switched on for this client and has no Channex property behind it. They can open the app; nothing they do in it will reach an OTA.";
}
