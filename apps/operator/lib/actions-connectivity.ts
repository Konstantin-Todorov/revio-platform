"use server";

import { revalidatePath } from "next/cache";
import { forSystem, encryptSecret, decryptSecret } from "@revio/db";
import { getOperatorSession } from "./session";
import { flashError, setFlash } from "@revio/ui/flash";
import { checkChannexKey, type KeyCheck } from "./channex-key-check";

// Credentials are operator-perimeter data (RLS bypass-only table) — always via forSystem.
const prisma = forSystem();

export type ActionResult = { ok: boolean; error?: string; warning?: string };

/** Test a tenant's STORED key without changing it. Drives the "Check now" button. */
export async function testStoredKey(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to check a key.");
  const tenantId = String(fd.get("tenantId") ?? "").trim();
  const mode = String(fd.get("mode") ?? "").trim();
  if (!tenantId || !MODES.has(mode)) return flashError("Reload the page and try again.");

  const cred = await prisma.connectivityCredential.findUnique({
    where: { tenantId_mode: { tenantId, mode } },
  });
  if (!cred) return flashError("There is no key stored for this client and mode yet.");

  let result: KeyCheck;
  try {
    result = await checkChannexKey(decryptSecret(cred.cipher), mode);
  } catch {
    // A key we cannot decrypt is as unusable as one Channex rejects, and the operator needs to know
    // which of the two it is — CONNECTIVITY_SECRET having changed is a different repair.
    result = { ok: false, status: 0, properties: null, message: "This key cannot be decrypted — CONNECTIVITY_SECRET may have changed since it was saved." };
  }

  await prisma.connectivityCredential.update({
    where: { id: cred.id },
    data: { lastCheckedAt: new Date(), lastCheckOk: result.ok, lastCheckMessage: result.message.slice(0, 300) },
  });
  // Said out loud as well as recorded: pressing a button and watching a pill maybe change is not
  // an answer, and the pill cannot carry "it can see 2 properties".
  await setFlash(result.ok ? "success" : "error", result.message);
  revalidatePath("/connectivity");
}

const MODES = new Set(["channex_sandbox", "channex_prod"]);

/** Store (or replace) a tenant's Channex API key — encrypted at rest, never echoed back. */
export async function setConnectivityKey(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Not authorized." };

  const tenantId = String(fd.get("tenantId") ?? "").trim();
  const mode = String(fd.get("mode") ?? "").trim();
  const apiKey = String(fd.get("apiKey") ?? "").trim();
  if (!tenantId || !MODES.has(mode)) return { ok: false, error: "Pick a client and a mode." };
  if (!apiKey) return { ok: false, error: "Paste the API key." };

  /*
   * Test BEFORE storing.
   *
   * This used to store whatever was pasted. On 2026-09-01 that meant a dead key sat here looking
   * exactly like a working one while the first real hotel's channel silently did nothing for hours.
   * A credential nobody has exercised is not a credential, it is a hope.
   *
   * A rejected key is REFUSED rather than stored with a warning: the only reason to save one is a
   * typo, and the fix for a typo is to paste it again.
   */
  const check = await checkChannexKey(apiKey, mode);
  if (!check.ok) return { ok: false, error: check.message };

  const cipher = encryptSecret(apiKey);
  await prisma.connectivityCredential.upsert({
    where: { tenantId_mode: { tenantId, mode } },
    update: { cipher, lastCheckedAt: new Date(), lastCheckOk: true, lastCheckMessage: check.message },
    create: { tenantId, mode, cipher, lastCheckedAt: new Date(), lastCheckOk: true, lastCheckMessage: check.message },
  });
  revalidatePath("/connectivity");
  // A key that authenticates but sees no properties is not yet usable — say so rather than let the
  // green tick imply the hotel is ready to onboard.
  return check.properties === 0
    ? { ok: true, warning: "This key works, but it can see no properties yet. Provision the hotel before expecting a push to succeed." }
    : { ok: true };
}

export async function removeConnectivityKey(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return;
  const tenantId = String(fd.get("tenantId") ?? "").trim();
  const mode = String(fd.get("mode") ?? "").trim();
  if (!tenantId || !MODES.has(mode)) return;
  await prisma.connectivityCredential.deleteMany({ where: { tenantId, mode } });
  revalidatePath("/connectivity");
}
/**
 * Test the PLATFORM key — ours, the one nearly every hotel actually uses.
 *
 * We are certified with Channex as a **PMS partner**: one organisation (`konstantin.todoroff PMS`),
 * one key scoped to all properties, and Channex bills US per property with an active channel. A
 * hotel does not need a Channex account of its own and normally does not have one.
 *
 * So this key — not the per-tenant rows below it — is the one that matters, and until now the
 * console had no way to ask whether it worked. It is not stored in the database, so there is
 * nothing to record against; the answer is said out loud instead.
 */
export async function testPlatformKey(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return flashError("Sign in again to check the platform key.");
  const mode = String(fd.get("mode") ?? "").trim();
  if (!MODES.has(mode)) return flashError("Reload the page and try again.");

  const key = mode === "channex_prod" ? process.env.CHANNEX_PROD_KEY : process.env.CHANNEX_SANDBOX_KEY;
  if (!key) {
    return flashError(
      `No ${mode === "channex_prod" ? "CHANNEX_PROD_KEY" : "CHANNEX_SANDBOX_KEY"} is set on this service. ` +
      "It lives on channel-manager, reservation and pms in Railway — the operator console cannot read theirs.",
    );
  }

  const r = await checkChannexKey(key, mode);
  await setFlash(r.ok ? "success" : "error", `Platform key (${mode}): ${r.message}`);
  revalidatePath("/connectivity");
}
