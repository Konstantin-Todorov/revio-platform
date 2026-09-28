import { ACCOUNT_TYPE_BY_KEY, type AccountType } from "@revio/core";

/**
 * What kind of account this is, marked the same way everywhere it appears.
 *
 * A live client carries no chip — it is the normal case, and a label on every row is a label nobody
 * reads. The other three are always marked, because a pilot or a demo that reads as a paying
 * customer is exactly the confusion this exists to stop.
 */
const STYLE: Record<Exclude<AccountType, "live">, string> = {
  pilot: "bg-brand-50 text-brand-700",
  demo: "bg-warning-50 text-warning-700",
  test: "bg-ink-100 text-ink-600",
};

export function AccountTypeChip({ type, showLive = false }: { type: AccountType; showLive?: boolean }) {
  if (type === "live") {
    return showLive ? <span className="rounded bg-success-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success-700">Live client</span> : null;
  }
  return (
    <span title={ACCOUNT_TYPE_BY_KEY[type].blurb} className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STYLE[type]}`}>
      {ACCOUNT_TYPE_BY_KEY[type].label}
    </span>
  );
}
