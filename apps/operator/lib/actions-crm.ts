"use server";

import { revalidatePath } from "next/cache";
import { forSystem } from "@revio/db";
import { getOperatorSession } from "./session";
import { NOTE_KINDS, STAGES, rollRenewal, type NoteKind, type Stage } from "./account";

// Operator CRM lives behind `operator_only` RLS — only this bypass connection can see a row of it.
const prisma = forSystem();

export type ActionResult = { ok: boolean; error?: string };

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
/** `<input type="date">` gives YYYY-MM-DD. Parse as UTC midnight so a renewal never shifts a day. */
function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : null;
}
function int(fd: FormData, key: string): number | null {
  const n = Number(str(fd, key));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Every action revalidates both the client page and the two screens that aggregate its flags. */
function revalidate(tenantId: string) {
  revalidatePath(`/clients/${tenantId}`);
  revalidatePath("/clients");
  revalidatePath("/overview");
}

/**
 * Create or update the account record. Upsert rather than create-then-edit: the row is bookkeeping,
 * and making an operator "create an account" before they can type a phone number is a step that
 * exists only because of how the table is shaped.
 */
export async function saveAccount(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const tenantId = str(fd, "tenantId");
  if (!tenantId) return { ok: false, error: "Missing client." };

  const stage = str(fd, "stage") as Stage;
  if (!(STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Unknown stage." };

  const ownerOperatorId = str(fd, "ownerOperatorId") || null;
  const renewalDate = date(fd, "renewalDate");
  const contractTermMonths = int(fd, "contractTermMonths");
  const summary = str(fd, "summary") || null;

  const data = { stage, ownerOperatorId, renewalDate, contractTermMonths, summary };
  await prisma.clientAccount.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });

  revalidate(tenantId);
  return { ok: true };
}

/**
 * Mark the contract renewed: roll the date forward one term and log it.
 *
 * The log entry is the point. A renewal that only moves a date leaves no evidence it happened, and
 * "did we actually renew them or did someone just clear the flag?" is exactly the question you cannot
 * answer a year later.
 */
export async function markRenewed(fd: FormData): Promise<void> {
  const session = await getOperatorSession();
  if (!session) return;
  const tenantId = str(fd, "tenantId");
  const account = await prisma.clientAccount.findUnique({ where: { tenantId } });
  if (!account?.renewalDate) return;

  const next = rollRenewal(account.renewalDate, account.contractTermMonths ?? 12);
  await prisma.$transaction([
    prisma.clientAccount.update({ where: { tenantId }, data: { renewalDate: next, stage: "live" } }),
    prisma.clientNote.create({
      data: {
        tenantId,
        kind: "note",
        body: `Contract renewed. Next renewal ${next.toISOString().slice(0, 10)}.`,
        authorId: session.userId,
        authorName: session.name,
      },
    }),
  ]);

  revalidate(tenantId);
}

export async function saveContact(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const tenantId = str(fd, "tenantId");
  const name = str(fd, "name");
  if (!tenantId) return { ok: false, error: "Missing client." };
  if (!name) return { ok: false, error: "A name is required." };

  const email = str(fd, "email") || null;
  const phone = str(fd, "phone") || null;
  if (!email && !phone) return { ok: false, error: "Give at least an email or a phone number — a contact you cannot reach is not a contact." };

  const data = {
    name,
    role: str(fd, "role") || null,
    email,
    phone,
    isPrimary: fd.get("isPrimary") != null,
    isBilling: fd.get("isBilling") != null,
    note: str(fd, "note") || null,
  };

  const id = str(fd, "id");
  // Exactly one primary. Demoting the others here rather than trusting the UI keeps the invariant
  // true even when two operators are editing the same client.
  await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.clientContact.updateMany({
        where: { tenantId, isPrimary: true, ...(id ? { NOT: { id } } : {}) },
        data: { isPrimary: false },
      });
    }
    if (id) await tx.clientContact.update({ where: { id }, data });
    else await tx.clientContact.create({ data: { tenantId, ...data } });
  });

  revalidate(tenantId);
  return { ok: true };
}

export async function deleteContact(fd: FormData): Promise<void> {
  if (!(await getOperatorSession())) return;
  const id = str(fd, "id");
  const tenantId = str(fd, "tenantId");
  if (!id) return;
  await prisma.clientContact.delete({ where: { id } });
  revalidate(tenantId);
}

export async function addNote(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getOperatorSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const tenantId = str(fd, "tenantId");
  const body = str(fd, "body");
  if (!tenantId) return { ok: false, error: "Missing client." };
  if (!body) return { ok: false, error: "Write something." };

  const kind = str(fd, "kind") as NoteKind;
  if (!(NOTE_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Unknown entry type." };

  // A call logged on Monday for a call made on Friday belongs on Friday — see `ClientNote.occurredAt`.
  const occurredAt = date(fd, "occurredAt") ?? new Date();

  await prisma.clientNote.create({
    data: { tenantId, kind, body, occurredAt, authorId: session.userId, authorName: session.name },
  });

  revalidate(tenantId);
  return { ok: true };
}

export async function toggleNotePin(fd: FormData): Promise<void> {
  if (!(await getOperatorSession())) return;
  const id = str(fd, "id");
  const tenantId = str(fd, "tenantId");
  const note = await prisma.clientNote.findUnique({ where: { id } });
  if (!note) return;
  await prisma.clientNote.update({ where: { id }, data: { pinned: !note.pinned } });
  revalidate(tenantId);
}

export async function deleteNote(fd: FormData): Promise<void> {
  if (!(await getOperatorSession())) return;
  const id = str(fd, "id");
  const tenantId = str(fd, "tenantId");
  if (!id) return;
  await prisma.clientNote.delete({ where: { id } });
  revalidate(tenantId);
}
