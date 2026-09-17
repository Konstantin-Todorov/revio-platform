import { forSystem, decryptSecret } from "@revio/db";
import { parseAdapter, type ChannelAdapterDescriptor } from "./channex-channels.js";
import { CHANNEX_PROD_URL, CHANNEX_SANDBOX_URL } from "@revio/core";

/**
 * Creating an OTA connection over the API, so nobody has to open the Channex dashboard.
 *
 * `channex-channels.ts` is the pure half — it parses the descriptor Channex returns and decides which
 * fields a person should see. This is the half that talks to the network.
 *
 * ## The flow, verified against the live API rather than the docs
 *
 *   1. `GET  /channels/adapter?code=BookingCom`  → the form to render
 *   2. `POST /channels/test_connection`          → are these credentials real?
 *   3. `POST /channels`                          → create it (inactive)
 *   4. `POST /channels/{id}/activate`            → put the rooms on sale
 *
 * Step 4 is separated deliberately and is not called from here. Activating is the moment inventory
 * reaches an OTA and the moment Channex starts billing us for the property — it deserves its own
 * click, on a screen that says so, rather than being the tail of a create.
 *
 * ## What still cannot be automated
 *
 * The hotel authorising **us** inside the OTA's own extranet — Booking.com asking them to consent to
 * a connectivity provider changing their rates. That is their contract with the OTA and no API of
 * ours can answer it. `test_connection` is how we find out whether they have done it yet, which is
 * why it is a step and not an optimisation.
 */

const PROD = CHANNEX_PROD_URL;
const SANDBOX = CHANNEX_SANDBOX_URL;

export interface ChannexApiConfig {
  apiKey: string;
  baseUrl: string;
}

/** Resolve key + host together, so a sandbox key can never be sent to the production host. */
export async function channexApiConfig(tenantId: string, mode: string): Promise<ChannexApiConfig> {
  const cred = await forSystem().connectivityCredential.findUnique({
    where: { tenantId_mode: { tenantId, mode } },
  });
  let apiKey = "";
  if (cred) {
    try {
      apiKey = decryptSecret(cred.cipher);
    } catch {
      // Wrong CONNECTIVITY_SECRET or corrupted payload — fall through to env rather than pushing
      // unauthenticated. Same reasoning as `channexKey` in sync.ts.
    }
  }
  if (!apiKey) {
    apiKey = (mode === "channex_prod" ? process.env.CHANNEX_PROD_KEY : process.env.CHANNEX_SANDBOX_KEY) ?? "";
  }
  return { apiKey, baseUrl: mode === "channex_prod" ? PROD : SANDBOX };
}

async function call(cfg: ChannexApiConfig, method: string, path: string, body?: unknown): Promise<unknown> {
  if (!cfg.apiKey.trim()) {
    throw new Error("No Channex API key for this hotel. Add it in the Operator console under Connectivity.");
  }
  const init: RequestInit = {
    method,
    headers: { "user-api-key": cfg.apiKey, "content-type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`${cfg.baseUrl}${path}`, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Channex returns HTML on some 5xx. Keep the status, drop the markup.
  }
  if (!res.ok) {
    throw new Error(`Channex ${method} ${path} → ${res.status}: ${channexError(json) ?? text.slice(0, 300)}`);
  }
  return json;
}

/** Pull the human-readable part out of Channex's error shapes, which are not consistent. */
function channexError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const errors = (json as { errors?: unknown }).errors;
  if (typeof errors === "string") return errors;
  if (errors && typeof errors === "object") {
    const details = (errors as { details?: unknown; title?: unknown }).details;
    if (details && typeof details === "object") {
      return Object.entries(details as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join("; ");
    }
    const title = (errors as { title?: unknown }).title;
    if (typeof title === "string") return title;
  }
  return null;
}

/**
 * The form for one channel.
 *
 * `null` when Channex does not recognise the code — which it signals with a 500 rather than a 404 for
 * some inputs (`booking` and `Booking` both do this; the working code is `BookingCom`). Treated as
 * "no such channel" rather than thrown, because the caller's next move is the same either way.
 */
export async function fetchChannelAdapter(
  cfg: ChannexApiConfig,
  code: string,
): Promise<ChannelAdapterDescriptor | null> {
  try {
    return parseAdapter(await call(cfg, "GET", `/channels/adapter?code=${encodeURIComponent(code)}`));
  } catch {
    return null;
  }
}

export type ConnectionTest = { ok: true } | { ok: false; message: string };

/**
 * Are these credentials real, and has the hotel authorised us at the OTA yet?
 *
 * Run before creating anything. A channel created against credentials that do not work is a row that
 * looks connected in our UI and silently pushes nothing — the exact failure mode this platform keeps
 * finding and keeps closing.
 */
export async function testChannelConnection(
  cfg: ChannexApiConfig,
  code: string,
  propertyId: string,
  settings: Record<string, unknown>,
): Promise<ConnectionTest> {
  try {
    await call(cfg, "POST", "/channels/test_connection", {
      channel: { channel: code, property_id: propertyId, settings },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Create the channel. **Inactive** — see the note at the top about why activation is separate.
 *
 * Returns the Channex channel id, which becomes our `Channel.externalPropertyId`'s sibling: the
 * property id says which hotel, this says which connection.
 */
export async function createChannexChannel(
  cfg: ChannexApiConfig,
  input: { code: string; title: string; propertyId: string; settings: Record<string, unknown> },
): Promise<{ id: string }> {
  const body = {
    channel: {
      channel: input.code,
      title: input.title,
      property_id: input.propertyId,
      settings: input.settings,
      // Created switched off, always. The screen that turns it on states what that costs.
      is_active: false,
    },
  };
  const json = (await call(cfg, "POST", "/channels", body)) as { data?: { id?: string } } | null;
  const id = json?.data?.id;
  if (!id) throw new Error("Channex created the channel but returned no id.");
  return { id };
}

/** Put the hotel's rooms on sale. The billable moment — call it from a screen that says so. */
export async function activateChannexChannel(cfg: ChannexApiConfig, channelId: string): Promise<void> {
  await call(cfg, "POST", `/channels/${encodeURIComponent(channelId)}/activate`);
}

/**
 * Switch the channel off at Channex. The moment we stop being billed for that property.
 *
 * ## ⚠️ Nothing in this codebase called this until 2026-09-17, and the hole was expensive
 *
 * `activate` had existed since the connect flow was written and there was no counterpart. So:
 * disconnecting a channel closed the rooms and left the Channex channel ON; suspending an account
 * stopped our syncing and left it ON; and **deleting a client removed every record that the
 * property existed while it stayed ON and billable forever**. Channex bills per property with an
 * active channel, so each of those was a standing charge for a hotel we no longer had, which
 * nothing in the product could have told us about.
 *
 * Deactivation is reversible — `activateChannexChannel` puts it back, and that is the billable
 * moment again, which is why reconnecting has to say so.
 *
 * ⚠️ It is NOT `DELETE /channels/{id}`. That route exists and is not what we want: a deleted channel
 * cannot be reactivated, so a hotel that comes back has to be set up from nothing, and
 * `provisionChannexProperty` is one-shot.
 */
export async function deactivateChannexChannel(cfg: ChannexApiConfig, channelId: string): Promise<void> {
  await call(cfg, "POST", `/channels/${encodeURIComponent(channelId)}/deactivate`);
}


/**
 * Changes the channel itself recorded as FAILED, from its own task log.
 *
 * ## ⚠️ Why this is worth a request a night
 *
 * Channex keeps a task per change we send — `Property.UpdateAvailability`,
 * `Property.UpdateRestrictions` and so on — each with `success` and `errors[]`. It is **the
 * destination's account of whether our push landed**, and nothing in this codebase had ever read it.
 *
 * Every failure hunted on 2026-09-17 had one shape: our side reported success and the truth was
 * somewhere we were not looking. `SyncEvent` says what we *sent*; this says what they *did with it*.
 * Two independent records disagreeing is the only way that class of fault becomes visible at all.
 *
 * ⚠️ Windowed. The log is historical, and a failure from six weeks ago that somebody has since fixed
 * must not raise an alarm for ever. `filter[success]=false` is applied server-side — verified, and it
 * answered `total: 0` for our account, so the ordinary case costs one cheap request.
 */
export async function failedChannexTasks(
  cfg: ChannexApiConfig,
  propertyId: string,
  sinceDays = 7,
): Promise<{ ok: boolean; count: number; samples: string[] }> {
  /*
   * ⚠️ `call` THROWS on a non-2xx, and that must not become "no failures".
   *
   * An unreachable Channex reporting a clean bill of health is the precise mistake this whole
   * function exists to catch somebody else making. Caught, and reported as `ok: false` — a caller
   * that cannot tell "we asked and there were none" from "we could not ask" is no better off than
   * one that never asked.
   */
  let res: unknown;
  try {
    res = await call(
      cfg,
      "GET",
      `/tasks?filter[property_id]=${encodeURIComponent(propertyId)}&filter[success]=false` +
        `&order[inserted_at]=desc&pagination[limit]=100`,
    );
  } catch {
    return { ok: false, count: 0, samples: [] };
  }
  const rows = (res as { data?: { attributes?: { inserted_at?: string; task?: string; errors?: unknown } }[] } | null)?.data;
  // Not an array is the same story by another route: no answer, never "no failures".
  if (!Array.isArray(rows)) return { ok: false, count: 0, samples: [] };

  const cutoff = Date.now() - sinceDays * 86_400_000;
  const recent = rows.filter((r) => {
    const at = r.attributes?.inserted_at;
    return at ? Date.parse(at) >= cutoff : false;
  });
  return {
    ok: true,
    count: recent.length,
    samples: recent.slice(0, 3).map((r) => `${r.attributes?.task ?? "change"} — ${JSON.stringify(r.attributes?.errors ?? []).slice(0, 120)}`),
  };
}
