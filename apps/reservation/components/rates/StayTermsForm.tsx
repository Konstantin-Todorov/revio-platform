"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { addDays, stayTerms, stayTermsWords, type DepositKind, type FeeKind, type PaymentRule } from "@revio/core";
import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { Card, CardHeader } from "@revio/ui/primitives";
import { ActionForm } from "@revio/ui/action-form";
import { Field, inputCls } from "@/components/ui/Modal";
import { SaveFooter } from "./RoomTypeForm";
import { saveStayPolicy, type ActionResult } from "@/lib/actions-terms";
import { terms as termsDict } from "@/lib/i18n/terms";

export type StayPolicyValues = {
  id: string; name: string; code: string;
  payment: string; depositKind: string | null; depositValue: number | null; balanceDaysBefore: number | null;
  refundable: boolean; freeCancelDays: number;
  lateFee: string; lateFeePct: number | null; noShowFee: string; noShowFeePct: number | null;
};

/**
 * One set of payment & cancellation terms.
 *
 * The preview is the point of this screen: a hotelier choosing "deposit, 30%, balance 7 days
 * before" should read the exact sentences their guest will read — produced by the same function the
 * booking page uses — before saving, rather than discover them on their own website.
 */
export function StayTermsForm({ policy, currency, today }: { policy?: StayPolicyValues; currency: string; /** The property's today. */ today: string }) {
  const locale = useLocale();
  const s = translate(termsDict, locale);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveStayPolicy, null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);

  const [payment, setPayment] = useState<PaymentRule>((policy?.payment as PaymentRule) ?? "guarantee");
  const [depositKind, setDepositKind] = useState<DepositKind>((policy?.depositKind as DepositKind) ?? "percent");
  const [depositPercent, setDepositPercent] = useState(policy?.depositKind === "percent" ? String(policy.depositValue ?? "") : "30");
  const [depositFixed, setDepositFixed] = useState(policy?.depositKind === "fixed" && policy.depositValue != null ? String(policy.depositValue / 100) : "");
  const [balance, setBalance] = useState<"hotel" | "charge">(policy?.balanceDaysBefore != null ? "charge" : "hotel");
  const [balanceDays, setBalanceDays] = useState(String(policy?.balanceDaysBefore ?? 7));
  const [refundable, setRefundable] = useState(policy?.refundable ?? true);
  const [freeDays, setFreeDays] = useState(String(policy?.freeCancelDays ?? 1));
  const [lateFee, setLateFee] = useState<FeeKind>((policy?.lateFee as FeeKind) ?? "first_night");
  const [latePct, setLatePct] = useState(String(policy?.lateFeePct ?? 50));
  const [noShowFee, setNoShowFee] = useState<FeeKind>((policy?.noShowFee as FeeKind) ?? "first_night");
  const [noShowPct, setNoShowPct] = useState(String(policy?.noShowFeePct ?? 100));

  const preview = useMemo(() => {
    const arrival = addDays(today, 30);
    const n = (v: string) => (v.trim() === "" ? null : Math.trunc(Number(v.replace(",", "."))));
    const t = stayTerms(
      {
        payment,
        depositKind: payment === "deposit" ? depositKind : null,
        depositValue: depositKind === "percent" ? n(depositPercent) : Math.round(Number(depositFixed.replace(",", ".") || 0) * 100),
        balanceDaysBefore: payment !== "prepay" && balance === "charge" ? n(balanceDays) ?? 0 : null,
        refundable,
        freeCancelDays: Math.max(0, n(freeDays) ?? 0),
        lateFee, lateFeePct: n(latePct), noShowFee, noShowFeePct: n(noShowPct),
      },
      { totalMinor: 30000, firstNightMinor: 10000, arrival, today },
    );
    const lang = locale === "bg" ? "bg" : "en";
    const money = (m: number) => new Intl.NumberFormat(lang === "bg" ? "bg-BG" : "en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(m / 100);
    const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
    return stayTermsWords(t, lang, money, day).details;
  }, [payment, depositKind, depositPercent, depositFixed, balance, balanceDays, refundable, freeDays, lateFee, latePct, noShowFee, noShowPct, locale, currency, today]);

  const radio = "h-4 w-4 cursor-pointer border-surface-border text-brand-600";
  const choice = (active: boolean) =>
    `flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors ${active ? "border-brand-600 bg-brand-50/40" : "border-surface-border hover:border-ink-300"}`;
  const feeFields = (label: string, name: string, value: FeeKind, set: (v: FeeKind) => void, pct: string, setPct: (v: string) => void) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
      <Field label={label}>
        <select name={name} value={value} onChange={(e) => set(e.target.value as FeeKind)} className={inputCls}>
          {(["first_night", "full", "percent"] as const).map((k) => <option key={k} value={k}>{s.fee[k]}</option>)}
        </select>
      </Field>
      {value === "percent" && (
        <Field label={s.feePercent}>
          <input name={`${name}Pct`} type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className={inputCls} />
        </Field>
      )}
    </div>
  );

  return (
    <ActionForm action={formAction} state={state} onChange={() => setSavedAt(null)}>
      {policy && <input type="hidden" name="id" value={policy.id} />}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_20rem] xl:items-start">
        <Card>
          <CardHeader title={policy ? policy.name : s.newTitle} subtitle={s.subtitle} />
          <div className="space-y-6 px-5 pb-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
              <Field label={s.name}><input name="name" defaultValue={policy?.name} required className={inputCls} placeholder={s.namePlaceholder} /></Field>
              <Field label={s.code}><input name="code" defaultValue={policy?.code} className={inputCls} placeholder="FLEX3" /></Field>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-[13.5px] font-bold text-ink-900">{s.paymentTitle}</legend>
              {(["guarantee", "deposit", "prepay"] as const).map((k) => (
                <label key={k} className={choice(payment === k)}>
                  <input type="radio" name="payment" value={k} checked={payment === k} onChange={() => setPayment(k)} className={`mt-0.5 ${radio}`} />
                  <span>
                    <span className="font-semibold text-ink-900">{s.payment[k].label}</span>
                    <span className="block text-[11.5px] text-ink-500">{s.payment[k].hint}</span>
                  </span>
                </label>
              ))}
              {payment === "deposit" && (
                <div className="grid grid-cols-1 gap-3 pl-1 pt-1 sm:grid-cols-[1fr_9rem]">
                  <Field label={s.payment.deposit.label}>
                    <select name="depositKind" value={depositKind} onChange={(e) => setDepositKind(e.target.value as DepositKind)} className={inputCls}>
                      {(["percent", "first_night", "fixed"] as const).map((k) => <option key={k} value={k}>{s.depositKind[k]}</option>)}
                    </select>
                  </Field>
                  {depositKind === "percent" && (
                    <Field label={s.depositPercent}>
                      <input name="depositPercent" type="number" min={1} max={100} value={depositPercent} onChange={(e) => setDepositPercent(e.target.value)} className={inputCls} />
                    </Field>
                  )}
                  {depositKind === "fixed" && (
                    <Field label={`${s.depositFixed} (${currency})`}>
                      <input name="depositFixed" inputMode="decimal" value={depositFixed} onChange={(e) => setDepositFixed(e.target.value)} className={inputCls} />
                    </Field>
                  )}
                </div>
              )}
            </fieldset>

            {payment !== "prepay" && (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-[13.5px] font-bold text-ink-900">{s.balanceTitle}</legend>
                <label className="flex items-center gap-2 text-[13px] text-ink-700">
                  <input type="radio" name="balance" value="hotel" checked={balance === "hotel"} onChange={() => setBalance("hotel")} className={radio} /> {s.balanceAtHotel}
                </label>
                <label className="flex flex-wrap items-center gap-2 text-[13px] text-ink-700">
                  <input type="radio" name="balance" value="charge" checked={balance === "charge"} onChange={() => setBalance("charge")} className={radio} /> {s.balanceCharge}
                  {balance === "charge" && (
                    <input
                      name="balanceDaysBefore" type="number" min={0} max={365} value={balanceDays}
                      onChange={(e) => setBalanceDays(e.target.value)} aria-label={s.balanceDays}
                      className={`${inputCls} ml-1 !w-20`}
                    />
                  )}
                </label>
              </fieldset>
            )}

            <fieldset className="space-y-2">
              <legend className="mb-2 text-[13.5px] font-bold text-ink-900">{s.cancelTitle}</legend>
              <label className={choice(refundable)}>
                <input type="radio" name="refundable" value="yes" checked={refundable} onChange={() => setRefundable(true)} className={`mt-0.5 ${radio}`} />
                <span className="font-semibold text-ink-900">{s.refundable}</span>
              </label>
              <label className={choice(!refundable)}>
                <input type="radio" name="refundable" value="no" checked={!refundable} onChange={() => setRefundable(false)} className={`mt-0.5 ${radio}`} />
                <span>
                  <span className="font-semibold text-ink-900">{s.nonRefundable}</span>
                  <span className="block text-[11.5px] text-ink-500">{s.nonRefundableHint}</span>
                </span>
              </label>
              {refundable && (
                <div className="space-y-3 pl-1 pt-1">
                  <Field label={s.freeDays} hint={s.freeDaysHint}>
                    <input name="freeCancelDays" type="number" min={0} max={365} value={freeDays} onChange={(e) => setFreeDays(e.target.value)} className={`${inputCls} !w-28`} />
                  </Field>
                  {feeFields(s.lateFee, "lateFee", lateFee, setLateFee, latePct, setLatePct)}
                </div>
              )}
              <div className="pl-1 pt-1">{feeFields(s.noShowFee, "noShowFee", noShowFee, setNoShowFee, noShowPct, setNoShowPct)}</div>
            </fieldset>
          </div>
          <SaveFooter pending={pending} error={state?.error} saved={!!savedAt && !state?.error} />
        </Card>

        <aside className="rounded-xl border border-surface-border bg-surface-muted px-4 py-4 xl:sticky xl:top-5">
          <h3 className="text-[13px] font-bold text-ink-900">{s.previewTitle}</h3>
          <p className="mb-3 text-[11.5px] text-ink-400">{s.previewHint}</p>
          <ul className="space-y-1.5 text-[13px] text-ink-700">
            {preview.map((line, i) => (
              <li key={line} className={i === 0 ? "font-semibold text-ink-900" : ""}>{line}</li>
            ))}
          </ul>
        </aside>
      </div>
    </ActionForm>
  );
}
