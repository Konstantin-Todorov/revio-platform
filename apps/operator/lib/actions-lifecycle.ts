"use server";

import { revalidatePath } from "next/cache";
import { changeClientBilling, changeClientStatus, changeClientType, forSystem } from "@revio/db";
import { disconnectChannel, pauseChannel } from "@revio/connectivity";
import type { LifecycleAction } from "@revio/core";
import { setFlash } from "@revio/ui/flash";
import { getOperatorSession } from "./session";
import { applyEntitlement, type ProductField } from "./entitlements";

/**
 * The client page's four deliberate changes: status, type, billing and products.
 *
 * Each returns a result rather than redirecting, so the dialog it came from can say what went wrong
 * beside the fields that were filled in (`ActionForm` keeps them). Each asks why, and each is
 * written to the client's history — the rules and the record are `@revio/db`'s `client-lifecycle`.
 */
export type LifecycleFormResult = { ok: boolean; error?: string };

const prisma = forSystem();

function refresh(tenantId: string) {
  revalidatePath(`/clients/${tenantId}`, "layout");
  revalidatePath("/clients");
  revalidatePath("/overview");
}

const ACTIONS: readonly LifecycleAction[] = ["suspend", "reinstate", "close", "reopen"];

/**
 * Suspend, reinstate, close or reopen — with the channels dealt with FIRST.
 *
 * ⚠️ Suspending stops our syncing but leaves the rooms on sale at the OTA: a guest can still book
 * into an account nobody can sign in to, and that booking would not reach Revio. So the dialog
 * offers to pause (stop-sell) the channels as part of the same step, ticked by default.
 *
 * Closing goes further and REQUIRES the channels to be disconnected, because Channex bills us per
 * property with an active channel and a closed client must not keep a meter running. If any channel
 * refuses, nothing about the status changes, and the message says which one.
 */
export async function changeStatusAction(_prev: LifecycleFormResult | null, fd: FormData): Promise<LifecycleFormResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Your session has expired. Sign in again, then repeat this." };

  const tenantId = String(fd.get("tenantId") ?? "");
  const action = String(fd.get("action") ?? "") as LifecycleAction;
  if (!ACTIONS.includes(action)) return { ok: false, error: "Unknown change. Reload the page and try again." };
  const reason = String(fd.get("reason") ?? "").trim();
  const detail = String(fd.get("reasonDetail") ?? "").trim();
  const fullReason = reason === "Other" ? detail : [reason, detail].filter(Boolean).join(" — ");
  if ((action === "suspend" || action === "close") && !fullReason) {
    return { ok: false, error: reason === "Other" ? "Write the reason in the box — “Other” on its own tells nobody anything." : "Choose a reason." };
  }

  const channels = await prisma.channel.findMany({
    where: { tenantId, status: { in: ["connected", "paused", "pending"] } },
    select: { id: true, name: true, status: true, property: { select: { name: true } } },
  });

  if (action === "suspend" && fd.get("pauseChannels") != null) {
    const failed: string[] = [];
    for (const ch of channels.filter((c) => c.status === "connected")) {
      const r = await pauseChannel(prisma, ch.id);
      if (!r.ok) failed.push(`${ch.property.name} · ${ch.name}: ${r.error ?? "refused"}`);
    }
    if (failed.length) {
      return {
        ok: false,
        error: `The client was NOT suspended, because ${failed.length === 1 ? "a channel" : "some channels"} could not be paused — ${failed.join("; ")}. Any others are paused now. Try again, or untick “pause channels” to suspend without stop-selling.`,
      };
    }
  }

  if (action === "close") {
    const live = channels;
    if (live.length && fd.get("disconnectChannels") == null) {
      return { ok: false, error: `${live.length} channel${live.length === 1 ? " is" : "s are"} still connected. Tick “Disconnect every channel” — a closed client must not stay on sale, and Channex bills us for it.` };
    }
    const failed: string[] = [];
    for (const ch of live) {
      const r = await disconnectChannel(prisma, ch.id);
      if (!r.ok) failed.push(`${ch.property.name} · ${ch.name}: ${r.error ?? "refused"}`);
    }
    if (failed.length) {
      return { ok: false, error: `The client was NOT closed: ${failed.join("; ")}. The rest are disconnected. Open the Channels tab to deal with that one, then close again.` };
    }
  }

  const r = await changeClientStatus({ tenantId, action, reason: fullReason || null, actor: { id: session.userId, name: session.name } });
  if (!r.ok) return { ok: false, error: r.message };
  await setFlash("success", r.message);
  refresh(tenantId);
  return { ok: true };
}

export async function changeTypeAction(_prev: LifecycleFormResult | null, fd: FormData): Promise<LifecycleFormResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Your session has expired. Sign in again, then repeat this." };
  const tenantId = String(fd.get("tenantId") ?? "");
  const until = String(fd.get("freeUntil") ?? "");
  const freeUntil = until ? new Date(`${until}T00:00:00Z`) : new Date(Date.now() + 91 * 86_400_000);
  if (Number.isNaN(freeUntil.getTime())) return { ok: false, error: "The free-until date is not a date. Pick one from the calendar." };

  const r = await changeClientType({
    tenantId, type: String(fd.get("type") ?? ""), reason: String(fd.get("reason") ?? ""), freeUntil,
    actor: { id: session.userId, name: session.name },
  });
  if (!r.ok) return { ok: false, error: r.message };
  await setFlash("success", r.message);
  refresh(tenantId);
  return { ok: true };
}

export async function changeBillingAction(_prev: LifecycleFormResult | null, fd: FormData): Promise<LifecycleFormResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Your session has expired. Sign in again, then repeat this." };
  const tenantId = String(fd.get("tenantId") ?? "");
  const until = String(fd.get("freeUntil") ?? "");
  const freeUntil = until ? new Date(`${until}T00:00:00Z`) : null;
  if (freeUntil && Number.isNaN(freeUntil.getTime())) return { ok: false, error: "The free-until date is not a date. Pick one from the calendar." };

  const r = await changeClientBilling({
    tenantId, mode: String(fd.get("mode") ?? ""), freeUntil, note: String(fd.get("note") ?? ""),
    actor: { id: session.userId, name: session.name },
  });
  if (!r.ok) return { ok: false, error: r.message };
  await setFlash("success", r.message);
  refresh(tenantId);
  return { ok: true };
}

const PRODUCTS: { field: ProductField; name: string }[] = [
  { field: "channelManager", name: "RevioLink" },
  { field: "reservation", name: "RevioCRS" },
  { field: "pms", name: "RevioPMS" },
];

/**
 * All three products in one form, with one reason.
 *
 * The hotel is emailed about each product that actually changed, and each change is recorded twice:
 * in the hotel's own audit log (what) and in our history (who and why).
 */
export async function changeProductsAction(_prev: LifecycleFormResult | null, fd: FormData): Promise<LifecycleFormResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Your session has expired. Sign in again, then repeat this." };
  const tenantId = String(fd.get("tenantId") ?? "");
  const reason = String(fd.get("reason") ?? "").trim();
  if (!reason) return { ok: false, error: "Say why the products are changing — the hotel is emailed, and we will be asked." };

  const wanted = PRODUCTS.map((p) => ({ ...p, enabled: fd.get(p.field) != null }));
  if (!wanted.some((p) => p.enabled)) {
    return {
      ok: false,
      error: "A client needs at least one product to sign in to. To stop them using Revio, suspend or close the client instead — that keeps their products for when they come back.",
    };
  }

  const changed: string[] = [];
  for (const p of wanted) {
    const r = await applyEntitlement({ tenantId, product: p.field, enabled: p.enabled, reason, session });
    if (r === "gone") return { ok: false, error: "That client no longer exists — it may have been deleted. Go back to the client list." };
    if (r === "changed") changed.push(`${p.name} ${p.enabled ? "on" : "off"}`);
  }
  if (!changed.length) return { ok: false, error: "Nothing changed — those are already their products." };
  await setFlash("success", `Products updated: ${changed.join(", ")}. The owner has been emailed.`);
  refresh(tenantId);
  return { ok: true };
}
