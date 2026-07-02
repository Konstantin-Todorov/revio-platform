"use server";

import { revalidatePath } from "next/cache";
import { forSystem, encryptSecret } from "@revio/db";
import { getOperatorSession } from "./session";

// Credentials are operator-perimeter data (RLS bypass-only table) — always via forSystem.
const prisma = forSystem();

export type ActionResult = { ok: boolean; error?: string };

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

  const cipher = encryptSecret(apiKey);
  await prisma.connectivityCredential.upsert({
    where: { tenantId_mode: { tenantId, mode } },
    update: { cipher },
    create: { tenantId, mode, cipher },
  });
  revalidatePath("/connectivity");
  return { ok: true };
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