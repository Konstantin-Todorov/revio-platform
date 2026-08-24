import { forSystem } from "./rls.js";

/**
 * Recording an unhandled server error.
 *
 * There was previously nowhere for one to go. The Sync and Error Centers cover OTA failures — a real
 * category, and not this one. An exception thrown in checkout, in a folio, in the invoice issuer,
 * went to a container log that rotates and that nobody reads at 23:00. The detection mechanism for a
 * crash was a hotel telephoning to say the screen went white.
 *
 * ## Never throws
 *
 * Same rule as `recordAuthEvent`, and for a stronger reason: this runs *inside the error handler*.
 * A reporter that can throw turns one handled 500 into an unhandled crash, and does it precisely
 * when things are already going wrong.
 */

/** Roughly the length of a useful stack. Enough to reproduce; not enough to bloat a row. */
const STACK_LIMIT = 4000;
const MESSAGE_LIMIT = 500;

/**
 * A stable identity for "the same bug".
 *
 * Message plus the first stack frame. The message alone collapses genuinely different faults that
 * share a generic one ("Not found" from the folio and from the invoice issuer are two bugs); the
 * whole stack never collides at all, because line numbers move between deploys and the same fault
 * would look brand new after every push.
 *
 * ## Not hashed, deliberately
 *
 * The first version used SHA-256, which cost a `node:crypto` import in a barrel that client
 * components reach — and broke the operator build, exactly as the TOTP module did. A hash was never
 * needed: this is a dedup key, not a security primitive, and the composite is strictly better than
 * a digest of it. It cannot collide, because it IS the identity rather than a summary of it, and it
 * is readable in the database, which matters when the reason two faults merged is itself the bug.
 */
const PART = 180;

export function errorSignature(message: string, stack: string | undefined): string {
  const frame = stack?.split("\n").find((l) => /\s+at\s/.test(l))?.trim() ?? "";
  const stable = frame
    // A one-line edit above the fault must not re-key it.
    .replace(/:\d+:\d+/g, "")
    // Next appends a build id to chunk paths; without this every deploy invents new faults.
    .replace(/\?[\w-]+/g, "");
  return `${message.slice(0, PART)}@${stable.slice(0, PART)}`;
}

export type ServiceName = "cm" | "crs" | "pms" | "operator" | "booking";

export interface RecordErrorInput {
  service: ServiceName;
  error: unknown;
  /** The route being served, when the framework knows it. */
  route?: string | null;
}

export async function recordAppError(input: RecordErrorInput): Promise<void> {
  try {
    const err = input.error;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, MESSAGE_LIMIT) || "Unknown error";
    const stack = err instanceof Error ? err.stack?.slice(0, STACK_LIMIT) : undefined;
    const signature = errorSignature(message, stack);
    const now = new Date();

    await forSystem().appError.upsert({
      where: { service_signature: { service: input.service, signature } },
      create: {
        service: input.service, signature, message,
        route: input.route ?? null, stack: stack ?? null,
        firstSeenAt: now, lastSeenAt: now,
      },
      update: {
        count: { increment: 1 },
        lastSeenAt: now,
        // The newest stack wins: it is the one from the deploy currently running.
        stack: stack ?? null,
        // A fault someone marked resolved that has happened again is not resolved. Re-opening it
        // automatically is the difference between a list of open bugs and a list of old opinions.
        resolvedAt: null,
      },
    });
  } catch {
    // Deliberately silent — see above. This runs inside the error handler.
  }
}

export interface AppErrorRow {
  id: string;
  service: string;
  message: string;
  route: string | null;
  stack: string | null;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

/** Unresolved faults, worst first. "Worst" is most recent — an old bug nobody hit today can wait. */
export async function listAppErrors(limit = 50): Promise<AppErrorRow[]> {
  return forSystem().appError.findMany({
    where: { resolvedAt: null },
    orderBy: { lastSeenAt: "desc" },
    take: Math.min(limit, 200),
    select: {
      id: true, service: true, message: true, route: true, stack: true,
      count: true, firstSeenAt: true, lastSeenAt: true, resolvedAt: true,
    },
  });
}

/** How many distinct faults are open — the number worth putting on a dashboard. */
export async function countOpenAppErrors(): Promise<number> {
  try {
    return await forSystem().appError.count({ where: { resolvedAt: null } });
  } catch {
    return 0;
  }
}

export async function resolveAppError(id: string): Promise<void> {
  await forSystem().appError.update({ where: { id }, data: { resolvedAt: new Date() } });
}

/**
 * Drop resolved faults older than the retention window.
 *
 * Unresolved ones are kept regardless of age: an open bug does not stop mattering because it is old.
 */
export async function pruneAppErrors(now = new Date(), days = 90): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const { count } = await forSystem().appError.deleteMany({
    where: { resolvedAt: { not: null, lt: cutoff } },
  });
  return count;
}
