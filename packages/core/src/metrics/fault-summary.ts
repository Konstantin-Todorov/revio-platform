/**
 * Turn a crash into something a person can act on.
 *
 * ## Why
 *
 * The operator console rendered a full Prisma exception — `prisma.ratePrice.upsert()` with internal
 * ids and every argument — straight into the health screen as the fault's headline.
 *
 * Nobody who uses that screen can act on it. Support cannot triage a Prisma invocation; they can
 * triage a client name and a screen name. **The console's job is to route a fault to a person, and a
 * stack trace routes it nowhere.**
 *
 * So the raw text stays — behind a disclosure, for whoever needs it — and the headline becomes the
 * shortest true sentence about what happened.
 *
 * Deliberately a small set of patterns rather than a parser. Anything unrecognised falls back to the
 * first line of the message, which is nearly always the useful part; guessing harder would produce
 * confident nonsense on the faults we have not seen yet.
 */

export interface FaultSummary {
  /** One line, in the words of somebody using the product. */
  headline: string;
  /** What kind of fault, for grouping and for deciding who looks. */
  kind: "invalid_value" | "not_found" | "conflict" | "permission" | "timeout" | "upstream" | "unknown";
  /** True when the fault is almost certainly OUR defect rather than an environment problem. */
  ourBug: boolean;
}

/** `prisma.ratePrice.upsert()` → "rate price". Internal names made readable, not hidden. */
function modelPhrase(model: string): string {
  return model
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
}

export function summariseFault(message: string, route?: string | null): FaultSummary {
  const first = (message ?? "").split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "Unknown error";
  const where = route ? ` on ${route}` : "";

  // Prisma's invocation dumps are the common case and the one that started this.
  const prisma = /Invalid `prisma\.(\w+)\.(\w+)\(\)` invocation/i.exec(message ?? "");
  if (prisma) {
    const what = modelPhrase(prisma[1]!);
    // `NaN` in the arguments is the specific defect this was found by: a price field that parsed to
    // NaN and reached the database. Naming it is the difference between a triage and a hunt.
    if (/\bNaN\b/.test(message)) {
      return {
        headline: `A ${what} was saved with a value that isn't a number${where}`,
        kind: "invalid_value",
        ourBug: true,
      };
    }
    if (/Unique constraint failed/i.test(message)) {
      return { headline: `A ${what} already exists${where}`, kind: "conflict", ourBug: true };
    }
    if (/Foreign key constraint/i.test(message)) {
      return { headline: `A ${what} referred to something that no longer exists${where}`, kind: "not_found", ourBug: true };
    }
    if (/Argument .* is missing|Null constraint/i.test(message)) {
      return { headline: `A ${what} was saved without a required value${where}`, kind: "invalid_value", ourBug: true };
    }
    return { headline: `A ${what} could not be saved${where}`, kind: "invalid_value", ourBug: true };
  }

  if (/record to update not found|no .* found/i.test(first)) {
    return { headline: `Something being changed had already gone${where}`, kind: "not_found", ourBug: false };
  }
  if (/unauthor|forbidden|401|403/i.test(first)) {
    return { headline: `An upstream service refused us${where}`, kind: "permission", ourBug: false };
  }
  if (/timeout|ETIMEDOUT|ECONNRESET|socket hang up/i.test(first)) {
    return { headline: `A request timed out${where}`, kind: "timeout", ourBug: false };
  }
  if (/channex|fetch failed|ENOTFOUND|502|503/i.test(first)) {
    return { headline: `An upstream service failed${where}`, kind: "upstream", ourBug: false };
  }

  // Unrecognised: the first line, trimmed. Better a short true thing than a confident wrong one.
  return { headline: first.length > 140 ? `${first.slice(0, 137)}…` : first, kind: "unknown", ourBug: false };
}

/** Which service the fault came from, in product words rather than folder names. */
export const SERVICE_PRODUCT: Readonly<Record<string, string>> = {
  cm: "RevioLink",
  reservation: "RevioCRS",
  pms: "RevioPMS",
  booking: "RevioDirect",
  operator: "Operator",
};
