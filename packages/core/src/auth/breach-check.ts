import { createHash } from "node:crypto";

/**
 * Has this password appeared in a known breach? (N5)
 *
 * The single most useful password rule there is. "At least ten characters" stops nothing if the ten
 * characters are one of the hundreds of millions already published in a wordlist — and composition
 * rules produce `Password1!`, which is in every one of them. NIST 800-63B says the same: check
 * against known-compromised passwords, and drop the character-class theatre.
 *
 * ## The password never leaves this process
 *
 * Have I Been Pwned's range API is k-anonymous. We SHA-1 the password, send the FIRST FIVE hex
 * characters, and get back every suffix sharing that prefix — several hundred of them — then match
 * locally. The service learns a bucket that contains roughly half a million passwords and cannot
 * tell which one was asked about, or even whether the answer was yes.
 *
 * SHA-1 here is not a security choice and is not protecting anything: it is the index the public
 * dataset happens to be keyed on. The password's actual storage is bcrypt, elsewhere.
 *
 * ## It fails OPEN, deliberately
 *
 * If the service is slow, down, or blocked by egress rules, a person setting a password gets
 * through. The alternative is that an outage at a third party stops a hotel's new manager from
 * finishing their invitation — a certain, immediate failure traded against a probabilistic one. The
 * local rules in `validatePassword` still apply and are not network-dependent.
 *
 * Only ever called when a password is CHOSEN, never on sign-in: sign-in must not depend on an
 * outbound request, and a password already set is not improved by blocking its owner at the door.
 */

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range";

/** Short enough that setting a password never feels stuck waiting on somebody else's service. */
const TIMEOUT_MS = 2500;

export interface BreachResult {
  /** True only when we KNOW it is breached. Unreachable service reports false, not "maybe". */
  breached: boolean;
  /** How many times it appears in the corpus, when known — useful for a message with weight. */
  count?: number;
  /** True when the check could not run. The caller allows the password but may want to log this. */
  skipped?: boolean;
}

export async function isBreachedPassword(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BreachResult> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${HIBP_RANGE_URL}/${prefix}`, {
      signal: controller.signal,
      headers: {
        // Asks the API to pad the response with fake entries, so an observer cannot infer anything
        // from its SIZE. Without it, response length leaks a little about the bucket.
        "Add-Padding": "true",
        "User-Agent": "Revio-Platform-PasswordCheck",
      },
    });
    if (!res.ok) return { breached: false, skipped: true };

    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, countText] = line.trim().split(":");
      if (hashSuffix !== suffix) continue;
      const count = Number.parseInt(countText ?? "0", 10);
      // Padding entries come back with a count of 0 and are not real matches.
      if (!Number.isFinite(count) || count <= 0) return { breached: false };
      return { breached: true, count };
    }
    return { breached: false };
  } catch {
    // Timeout, DNS, offline, blocked egress — all the same answer: we do not know, so we do not
    // block. See the note above about failing open.
    return { breached: false, skipped: true };
  } finally {
    clearTimeout(timer);
  }
}

/** The message shown when a password is known to be compromised. */
export function breachMessage(count?: number): string {
  return count && count > 1
    ? `This password has appeared in ${count.toLocaleString("en-GB")} known data breaches. Please choose a different one.`
    : "This password has appeared in a known data breach. Please choose a different one.";
}
