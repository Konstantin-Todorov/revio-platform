/**
 * Read one encrypted Stripe value without collapsing two different failures into `null`.
 *
 * Missing means setup has not happened. Undecryptable means setup DID happen but the encryption
 * key no longer matches — commonly a broken CONNECTIVITY_SECRET rotation. Those require different
 * action and must never share a green historical health check.
 */
export type StoredSecretRead =
  | { state: "ready"; secret: string }
  | { state: "missing" }
  | { state: "decryption_error" };

export function readStoredSecret(
  cipher: string | null | undefined,
  decrypt: (value: string) => string,
): StoredSecretRead {
  if (!cipher) return { state: "missing" };
  try {
    return { state: "ready", secret: decrypt(cipher) };
  } catch {
    return { state: "decryption_error" };
  }
}
