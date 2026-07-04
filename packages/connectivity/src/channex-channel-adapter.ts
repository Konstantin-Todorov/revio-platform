/**
 * ChannexChannelAdapter — a REAL ChannelAdapter that talks to Channex over HTTP, implementing the
 * exact same `@revio/core` contract as MockChannelAdapter. The apps can therefore swap mock → Channex
 * per tenant with no other change (see root CLAUDE.md "Connectivity is behind an adapter").
 *
 * Endpoints (https://docs.channex.io/api-v.1-documentation):
 *   POST /api/v1/restrictions  — rate + min/max stay + CTA/CTD + stop_sell, per rate plan / date
 *   POST /api/v1/availability  — room count, per room type / date
 *   GET  /api/v1/bookings      — imported bookings, filterable by inserted_at
 * Auth: header `user-api-key: <key>`. Sandbox base: https://staging.channex.io/api/v1.
 */

import type { AriUpdate, ChannelAdapter, PushResult, RawReservation } from "@revio/core";
import {
  toAvailabilityValue,
  toRawReservation,
  toRestrictionValue,
  unsupportedReason,
  type ChannexBooking,
} from "./channex-mappers.js";

/** Channex staging/sandbox API base. Use a free account at https://staging.channex.io to test. */
export const CHANNEX_STAGING_URL = "https://staging.channex.io/api/v1";

export interface ChannexConfig {
  /** `user-api-key` from the Channex user profile. */
  apiKey: string;
  /** Channex Property UUID — in our schema this is `Channel.externalPropertyId`. */
  propertyId: string;
  /** API base URL. Defaults to staging; pass the production base (from Channex) for live tenants. */
  baseUrl?: string;
  /** Our logical channel code for this connection, e.g. "booking". */
  channelCode?: string;
}

interface ApiResult {
  ok: boolean;
  status: number;
  responseId?: string;
  error?: string;
  body: unknown;
}

export class ChannexChannelAdapter implements ChannelAdapter {
  readonly channelCode: string;
  private readonly apiKey: string;
  private readonly propertyId: string;
  private readonly baseUrl: string;

  constructor(config: ChannexConfig) {
    this.apiKey = config.apiKey;
    this.propertyId = config.propertyId;
    this.baseUrl = (config.baseUrl ?? CHANNEX_STAGING_URL).replace(/\/$/, "");
    this.channelCode = config.channelCode ?? "channex";
  }

  async pushAri(updates: AriUpdate[]): Promise<PushResult> {
    const rejected: PushResult["rejected"] = [];
    const supported: AriUpdate[] = [];
    for (const update of updates) {
      const reason = unsupportedReason(update);
      if (reason) rejected.push({ update, reason });
      else supported.push(update);
    }

    if (supported.length === 0) {
      return { ok: rejected.length === 0, rejected };
    }

    // Two batched calls keep us well under Channex's per-property rate limits (and satisfy the
    // certification "500 days in ≤ 2 API calls" rule regardless of how many days are batched).
    const restrictions = await this.pushRatesAndRestrictions(supported);
    const availability = await this.pushAvailability(supported);

    if (!restrictions.ok) {
      for (const update of supported) rejected.push({ update, reason: `restrictions: ${restrictions.error}` });
    }
    if (!availability.ok) {
      for (const update of supported) rejected.push({ update, reason: `availability: ${availability.error}` });
    }

    const result: PushResult = { ok: restrictions.ok && availability.ok, rejected };
    // Channex returns a task id per call ({data:[{id,type:"task"}]}); keep both — the certification
    // form wants the task id from each ARI push.
    const taskIds = [restrictions.taskId, availability.taskId].filter((id): id is string => !!id);
    if (taskIds.length) {
      result.taskIds = taskIds;
      result.channelResponseId = taskIds[0]!;
    }
    return result;
  }

  /** Push only rates + restrictions (one Channex /restrictions call). Returns the Channex task id. */
  async pushRatesAndRestrictions(updates: AriUpdate[]): Promise<{ ok: boolean; taskId?: string; error?: string }> {
    const res = await this.post("/restrictions", {
      values: updates.map((u) => toRestrictionValue(this.propertyId, u)),
    });
    return res.ok ? { ok: true, ...(res.responseId ? { taskId: res.responseId } : {}) } : { ok: false, error: res.error ?? `HTTP ${res.status}` };
  }

  /** Push only availability (one Channex /availability call). Returns the Channex task id. */
  async pushAvailability(updates: AriUpdate[]): Promise<{ ok: boolean; taskId?: string; error?: string }> {
    const res = await this.post("/availability", {
      values: updates.map((u) => toAvailabilityValue(this.propertyId, u)),
    });
    return res.ok ? { ok: true, ...(res.responseId ? { taskId: res.responseId } : {}) } : { ok: false, error: res.error ?? `HTTP ${res.status}` };
  }

  async pullReservations(since: string): Promise<RawReservation[]> {
    const params = new URLSearchParams();
    params.set("filter[property_id]", this.propertyId);
    if (since) params.set("filter[inserted_at][gte]", since);
    params.set("order[inserted_at]", "asc");

    const res = await this.get(`/bookings?${params.toString()}`);
    if (!res.ok) return [];
    const data = (res.body as { data?: ChannexBooking[] } | null)?.data ?? [];
    return data.map(toRawReservation);
  }

  /**
   * Acknowledge a booking revision so Channex stops re-sending it (Channex re-delivers unacked
   * revisions for 30 min, then emails a warning). Required for PMS certification. The revision id is
   * `attributes.revision_id` on a pulled booking.
   */
  async acknowledgeBooking(revisionId: string): Promise<{ ok: boolean; error?: string }> {
    const res = await this.post(`/booking_revisions/${revisionId}/ack`, {});
    return res.ok ? { ok: true } : { ok: false, error: res.error ?? `HTTP ${res.status}` };
  }

  // --- HTTP --------------------------------------------------------------

  private headers(): Record<string, string> {
    return {
      "user-api-key": this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async post(path: string, body: unknown): Promise<ApiResult> {
    return this.request("POST", path, body);
  }

  private async get(path: string): Promise<ApiResult> {
    return this.request("GET", path);
  }

  private async request(method: string, path: string, body?: unknown): Promise<ApiResult> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (err) {
      return { ok: false, status: 0, error: `network error: ${(err as Error).message}`, body: null };
    }

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: extractError(parsed) ?? `HTTP ${res.status}`, body: parsed };
    }
    // ARI pushes return {data:[{id,type:"task"}]} (array); other creates return {data:{id}} (object).
    const dataField = (parsed as { data?: unknown } | null)?.data;
    const responseId = Array.isArray(dataField)
      ? (dataField[0] as { id?: string } | undefined)?.id
      : (dataField as { id?: string } | undefined)?.id;
    return { ok: true, status: res.status, body: parsed, ...(responseId ? { responseId } : {}) };
  }
}

/** Channex returns validation problems under `errors`; pull out a readable message. */
function extractError(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" ? body : null;
  const errors = (body as { errors?: unknown }).errors;
  if (!errors) return null;
  if (typeof errors === "string") return errors;
  try {
    return JSON.stringify(errors);
  } catch {
    return "unknown error";
  }
}
