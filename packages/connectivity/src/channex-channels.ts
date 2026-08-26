/**
 * Connecting an OTA from our own software, instead of from the Channex dashboard.
 *
 * Onboarding a hotel was one command plus a manual step: somebody opens Channex, picks Booking.com,
 * types the hotel's ID, maps rooms and rates by hand, activates. That step is the reason onboarding
 * needs a person who knows Channex, and it is the step most likely to be done differently twice.
 *
 * It does not have to be manual. Channex exposes the whole flow:
 *
 *   GET  /channels/adapter?code=…    what this channel needs — **a field descriptor, not a fixed list**
 *   POST /channels/test_connection   are these credentials real, before anything is created
 *   POST /channels/mapping_details   what rooms and rates the OTA side has
 *   POST /channels                   create it (disabled)
 *   POST /channels/{id}/activate     turn it on
 *
 * The first call is the one that matters. Channex *describes its own form* — name, type, title,
 * defaults, select options, even conditional visibility — so our screen can render the right fields
 * for any channel without knowing anything about that channel. Booking.com asks for a Hotel ID;
 * Expedia asks for a Hotel ID, a min-stay type and an optional notification email. Neither is
 * hardcoded here, and a channel Channex adds next year works without a deploy.
 *
 * ## What still cannot be automated, and why
 *
 * The hotel authorises us on the **OTA's** side — in the Booking.com extranet, they nominate Channex
 * as their connectivity provider. No API can do that for them: it is the OTA asking the hotel
 * "do you consent to this company changing your rates?", and the answer has to come from the hotel.
 * Airbnb goes further and uses OAuth. Everything after that consent is ours to automate.
 */

export type ChannelFieldType = "string" | "boolean" | "select" | "hidden" | "number";

export interface ChannelField {
  /** The key to send back in `settings`. */
  name: string;
  type: ChannelFieldType;
  /** Channex's own label — shown to the hotel as-is, so it matches their OTA extranet's wording. */
  title: string;
  position: number;
  default?: unknown;
  /** For `select`. */
  options?: string[];
  /**
   * Channex's conditional rules, passed through untouched.
   *
   * Interpreted by the UI, not here: this module's job is to report what Channex said, and a rule
   * engine in the data layer is a second place for the form to be wrong.
   */
  rules?: unknown;
}

export interface ChannelAdapterDescriptor {
  code: string;
  title: string;
  /** Sorted by Channex's own `position`, so the form reads in the order they intended. */
  fields: ChannelField[];
}

/**
 * The channels we can offer, with the code Channex expects.
 *
 * A list rather than a fetch because Channex has no "list adapters" endpoint — the descriptor is
 * per-code. Verified against the live API on 2026-08-26; `booking` and `Booking` both 500, which is
 * why the exact casing is written down rather than guessed at.
 */
export const CHANNEL_CODES = [
  { code: "BookingCom", name: "Booking.com" },
  { code: "Expedia", name: "Expedia" },
  { code: "Agoda", name: "Agoda" },
  { code: "Airbnb", name: "Airbnb" },
  { code: "Hotelbeds", name: "Hotelbeds" },
  { code: "Ctrip", name: "Trip.com" },
  { code: "Despegar", name: "Despegar" },
] as const;

/** Normalise one Channex `params` entry into something a form can render. */
export function toField(name: string, spec: Record<string, unknown>): ChannelField {
  const type = String(spec.type ?? "string");
  return {
    name,
    type: (["string", "boolean", "select", "hidden", "number"].includes(type) ? type : "string") as ChannelFieldType,
    title: String(spec.title ?? name),
    position: Number(spec.position ?? 99),
    ...(spec.default !== undefined ? { default: spec.default } : {}),
    ...(Array.isArray(spec.options) ? { options: spec.options.map(String) } : {}),
    ...(spec.rules !== undefined ? { rules: spec.rules } : {}),
  };
}

/**
 * Parse an adapter response into a descriptor.
 *
 * Split from the fetch so it can be tested against a real recorded response without a network call —
 * the shape is Channex's and we do not control it, so it is exactly the part worth pinning.
 */
export function parseAdapter(body: unknown): ChannelAdapterDescriptor | null {
  const data = (body as { data?: { code?: string; title?: string; params?: Record<string, Record<string, unknown>> } })?.data;
  if (!data?.params) return null;
  return {
    code: String(data.code ?? ""),
    title: String(data.title ?? data.code ?? ""),
    fields: Object.entries(data.params)
      .map(([name, spec]) => toField(name, spec))
      .sort((a, b) => a.position - b.position),
  };
}

/**
 * The fields a hotel actually has to fill in.
 *
 * `hidden` fields are Channex's own plumbing — payout permissions, machine account ids — and putting
 * them on a hotelier's screen would be asking a question they cannot answer. Sent back as defaults,
 * never rendered.
 */
export function visibleFields(d: ChannelAdapterDescriptor): ChannelField[] {
  return d.fields.filter((f) => f.type !== "hidden");
}

/** Defaults for everything, including the hidden fields, as the starting `settings` object. */
export function defaultSettings(d: ChannelAdapterDescriptor): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of d.fields) if (f.default !== undefined) out[f.name] = f.default;
  return out;
}

/**
 * Which required fields are still empty.
 *
 * Checked before `test_connection` rather than instead of it: this catches a blank box instantly,
 * and only Channex can say whether a filled-in Hotel ID is a real one.
 */
export function missingRequired(d: ChannelAdapterDescriptor, settings: Record<string, unknown>): string[] {
  return visibleFields(d)
    // Booleans and selects always have a value; a blank string is the only real gap.
    .filter((f) => f.type === "string" || f.type === "number")
    .filter((f) => {
      const v = settings[f.name];
      return v === undefined || v === null || String(v).trim() === "";
    })
    .map((f) => f.title);
}
