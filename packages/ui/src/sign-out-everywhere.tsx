/**
 * "Sign out everywhere" — the one control that reaches a device we cannot see.
 *
 * Presentational; each app passes its own server action, because the write belongs to the app. What
 * is shared is the wording, and the wording carries a fact that is easy to get wrong: revocation is
 * recorded on the **shared identity**, so this ends the person's sessions in every Revio product
 * their hotel runs — not just the one they happen to be looking at. A button that said "sign out of
 * RevioLink everywhere" would be describing something we do not do.
 *
 * It signs out the current device too. An "everywhere" that spares the browser you are sitting in is
 * not everywhere, and the cost of being wrong about that is a session left alive on a machine
 * somebody else has.
 */
export function SignOutEverywhere({
  action,
  productNames,
}: {
  action: () => Promise<void>;
  /** The products this hotel runs, so the warning names them rather than gesturing at "everything". */
  productNames: string[];
}) {
  const scope =
    productNames.length > 1
      ? `${productNames.slice(0, -1).join(", ")} and ${productNames[productNames.length - 1]}`
      : (productNames[0] ?? "Revio");

  return (
    <form action={action} className="space-y-3">
      <p className="text-[13px] leading-relaxed text-ink-600">
        Ends your session on every device — phones, tablets and any browser you have left signed in,
        across {scope}. Use it if you have lost a device or think someone else has your password.
      </p>
      <p className="text-[12.5px] text-ink-400">
        You will be signed out here too, and can sign back in straight away.
      </p>
      <button
        type="submit"
        className="h-10 rounded-md border border-danger-200 bg-white px-4 text-[13.5px] font-semibold text-danger-600 transition-colors hover:bg-danger-50"
      >
        Sign out everywhere
      </button>
    </form>
  );
}
