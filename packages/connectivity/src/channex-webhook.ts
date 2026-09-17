/**
 * Channex calls us the moment a booking arrives, instead of us asking every five minutes.
 *
 * ## ⚠️ The webhook carries NO booking data, on purpose
 *
 * It is a doorbell, not a delivery. When it rings we do our own authenticated pull from Channex and
 * trust that, exactly as the five-minute job does. Three things follow, and they are the whole
 * reason this design is safe:
 *
 *   * A forged request can cause at most **one extra pull**, which is idempotent. It cannot invent a
 *     booking, cancel one, or change a price.
 *   * We never parse untrusted reservation data off a public endpoint.
 *   * The webhook and the poll take the *same* code path, so there is no second import routine that
 *     can drift from the first — which is how two systems end up disagreeing about one booking.
 *
 * `send_data` is left at Channex's default of `false` for the same reason.
 *
 * ## ⚠️ It does NOT replace the poll
 *
 * A webhook that never arrives is silent, and silence reading as "nothing happened" is the exact
 * failure this platform spent 2026-09-17 removing — 411 "success" events against a dead key, and a
 * booking that sat unimported for two days. The five-minute pull stays as the safety net that
 * notices what the doorbell missed. The webhook buys latency, not certainty.
 *
 * ## One webhook per PROPERTY
 *
 * Channex keys a webhook on `property_id`. A property can carry Booking.com and Expedia at once, so
 * registering per channel would create a duplicate webhook per OTA and ring us twice for one
 * booking.
 */

import { forSystem } from "@revio/db";
import { channexApiConfig } from "./channex-channel-api.js";

/** Every event Channex can send. `*` rather than a list: a new event type we have not heard of is
 *  still a reason to re-pull, and the handler only ever pulls. */
const EVENT_MASK = "*";

/** The header Channex is told to send back to us. A shared secret, matched in the route. */
export const WEBHOOK_SECRET_HEADER = "x-revio-webhook";

export interface WebhookResult {
  ok: boolean;
  /** The Channex webhook id, when there is one. */
  id?: string;
  error?: string;
  /** True when nothing needed doing — already registered and still present. */
  unchanged?: boolean;
}

async function call(
  cfg: { apiKey: string; baseUrl: string },
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: { "user-api-key": cfg.apiKey, Accept: "application/json", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* Channex answers HTML on some 5xx. */ }
  return { status: res.status, body: parsed };
}

/**
 * Make sure this property has exactly one live webhook pointing at us.
 *
 * Idempotent: a property that already has one keeps it. Safe to call on every connect and from a
 * backfill.
 *
 * @param callbackUrl our public endpoint — built by the caller, which is the only place that knows
 *   its own origin.
 * @param secret the shared value Channex sends back in `WEBHOOK_SECRET_HEADER`. Without it the
 *   endpoint cannot tell a real ring from anyone on the internet, so an absent secret refuses.
 */
export async function ensureChannexWebhook(
  propertyId: string,
  callbackUrl: string,
  secret: string,
): Promise<WebhookResult> {
  if (!secret) {
    return { ok: false, error: "No webhook secret configured — refusing to register an endpoint nobody can authenticate." };
  }
  const db = forSystem();
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, tenantId: true, channexWebhookId: true },
  });
  if (!property) return { ok: false, error: "No such property." };

  const channel = await db.channel.findFirst({
    where: { propertyId, connectivityMode: { not: "mock" }, externalPropertyId: { not: null } },
    select: { connectivityMode: true, externalPropertyId: true },
  });
  if (!channel?.externalPropertyId) {
    return { ok: false, error: "This property has no Channex property id — nothing to register a webhook against." };
  }

  const cfg = await channexApiConfig(property.tenantId, channel.connectivityMode);

  // Already registered? Confirm Channex still has it before believing our own column.
  if (property.channexWebhookId) {
    const existing = await call(cfg, "GET", `/webhooks/${property.channexWebhookId}`);
    if (existing.status === 200) return { ok: true, id: property.channexWebhookId, unchanged: true };
    // 404: deleted on their side. Fall through and create a new one rather than stay silently unhooked.
  }

  const created = await call(cfg, "POST", "/webhooks", {
    webhook: {
      property_id: channel.externalPropertyId,
      callback_url: callbackUrl,
      event_mask: EVENT_MASK,
      // ⚠️ Created switched OFF by Channex, like a channel. Activated below, deliberately, so a
      // half-finished registration never leaves a live endpoint we have not recorded.
      is_active: true,
      send_data: false,
      headers: { [WEBHOOK_SECRET_HEADER]: secret },
    },
  });
  const id = (created.body as { data?: { id?: string } } | null)?.data?.id;
  if (created.status >= 300 || !id) {
    return { ok: false, error: `Channex refused the webhook (HTTP ${created.status}).` };
  }

  await db.property.update({ where: { id: propertyId }, data: { channexWebhookId: id } });
  return { ok: true, id };
}

/** Remove the webhook — called when a property's last real channel goes away. */
export async function removeChannexWebhook(propertyId: string): Promise<WebhookResult> {
  const db = forSystem();
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, tenantId: true, channexWebhookId: true },
  });
  if (!property?.channexWebhookId) return { ok: true, unchanged: true };
  const channel = await db.channel.findFirst({
    where: { propertyId, connectivityMode: { not: "mock" } },
    select: { connectivityMode: true },
  });
  if (!channel) return { ok: true, unchanged: true };

  const cfg = await channexApiConfig(property.tenantId, channel.connectivityMode);
  const res = await call(cfg, "DELETE", `/webhooks/${property.channexWebhookId}`);
  // 404 means it is already gone, which is the state we wanted.
  if (res.status >= 300 && res.status !== 404) {
    return { ok: false, error: `Channex refused to remove the webhook (HTTP ${res.status}).` };
  }
  await db.property.update({ where: { id: propertyId }, data: { channexWebhookId: null } });
  return { ok: true };
}
