import { AlertTriangle, Ban, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  validateRegisterEntry, registerCategory, expectedNameScript, COUNTRY_NAMES,
  type TouristRegisterEntry,
} from "@revio/core";
import { i18n } from "@/lib/i18n/server";
import { register } from "@/lib/i18n/register";
import { countryIn } from "@/lib/i18n/country";
import { saveStayGuest, addStayGuest, removeStayGuest, cancelStayGuest } from "@/lib/actions-register";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";

import { SubmitButton } from "@revio/ui/submit-button";
export type RegisterRow = TouristRegisterEntry & { id: string };

const input =
  "h-9 w-full rounded-md border border-surface-border bg-white px-2.5 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600";

function Lbl({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
      {children}
      {hint && <span className="ml-1 font-normal normal-case tracking-normal text-ink-300">{hint}</span>}
    </span>
  );
}

/**
 * Регистър на настанените туристи — the register card for one stay.
 *
 * Server-rendered plain forms, one per person, no client JavaScript. That is a deliberate choice for
 * a screen a receptionist fills in from a passport while somebody waits: it works on the oldest
 * device in the building, it survives a refresh, and a browser's own autofill cannot fight it.
 *
 * The card shows what is missing rather than refusing to save what is present. A half-typed entry is
 * worth keeping — the alternative is the receptionist writing the passport on paper "for later".
 */
export async function GuestRegisterCard({ reservationId, rows, today }: { reservationId: string; rows: RegisterRow[]; today: string }) {
  const { t: tr, locale } = await i18n();
  const t = tr(register).card;
  const countryName = countryIn(locale);
  const problemsById = new Map(rows.map((r) => [r.id, validateRegisterEntry(r)]));
  const complete = rows.filter((r) => problemsById.get(r.id)!.length === 0).length;

  return (
    <Card className="mt-4">
      <CardHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          rows.length > 0 ? (
            <StatusPill tone={complete === rows.length ? "success" : "warning"}>
              {t.completeOf(complete, rows.length)}
            </StatusPill>
          ) : undefined
        }
      />

      {rows.length === 0 && (
        <p className="px-4 py-6 text-[13px] text-ink-400">
          {t.opensAtCheckIn}
        </p>
      )}

      <div className="divide-y divide-surface-border/60">
        {rows.map((r) => {
          const problems = problemsById.get(r.id)!;
          const ok = problems.length === 0;
          const needsSeries = registerCategory(r.nationality) === "other";
          const script = expectedNameScript(r.nationality);
          // Before citizenship is set there is nothing to assume, and assuming produced a "latin"
          // hint over a Bulgarian guest's name and a "required" one over a series they do not need.
          const known = r.nationality.trim() !== "";
          const named = [r.firstName, r.middleName, r.lastName].filter((v) => v && v.trim()).join(" ");
          const blank = named === "" && r.documentNumber == null && r.personalId == null;

          return (
            <details key={r.id} open={!ok && !r.cancelled} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 hover:bg-surface-muted">
                <span className="tnum w-8 shrink-0 text-[11px] font-bold text-ink-300">№{r.registerNo}</span>
                {ok
                  ? <Check className="h-4 w-4 shrink-0 text-success-600" />
                  : <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" />}
                <span className={`flex-1 truncate text-[13px] font-semibold ${named ? "text-ink-900" : "text-ink-400 italic"} ${r.cancelled ? "line-through decoration-ink-300" : ""}`}>
                  {named || t.notCapturedYet}
                </span>
                {r.cancelled && (
                  <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-400">
                    {t.cancelled}
                  </span>
                )}
                <span className="shrink-0 text-[11.5px] text-ink-400">
                  {r.nationality ? countryName(r.nationality) : "—"}
                  {r.unitLabel ? t.room(r.unitLabel) : ""}
                </span>
              </summary>

              <form action={saveStayGuest} className="border-t border-surface-border/40 bg-surface-muted/30 px-4 py-3.5">
                <input type="hidden" name="id" value={r.id} />

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <label>
                    <Lbl hint={!known ? undefined : script === "cyrillic" ? t.cyrillic : t.latin}>{t.firstName}</Lbl>
                    <input name="firstName" defaultValue={r.firstName} className={input} placeholder={known && script === "cyrillic" ? t.firstNamePlaceholder.cyrillic : t.firstNamePlaceholder.latin} />
                  </label>
                  <label>
                    <Lbl hint={t.patronymicHint}>{t.patronymic}</Lbl>
                    <input name="middleName" defaultValue={r.middleName ?? ""} className={input} placeholder="—" />
                  </label>
                  <label>
                    <Lbl hint={!known ? undefined : script === "cyrillic" ? t.cyrillic : t.latin}>{t.familyName}</Lbl>
                    <input name="lastName" defaultValue={r.lastName} className={input} placeholder={known && script === "cyrillic" ? t.familyNamePlaceholder.cyrillic : t.familyNamePlaceholder.latin} />
                  </label>
                  <label>
                    <Lbl>{t.dateOfBirth}</Lbl>
                    {/*
                      ⚠️ The reverse of the rule everywhere else: a birth date may be as far in the
                      past as it likes, and can never be in the future. `max` rather than `min` —
                      see the `not-future` intent in packages/core/src/stays/past-dates.ts.
                    */}
                    <input name="dateOfBirth" type="date" max={today} defaultValue={r.dateOfBirth ?? ""} className={input} />
                  </label>
                  <label>
                    <Lbl>{t.sex}</Lbl>
                    <select name="sex" defaultValue={r.sex ?? ""} className={input}>
                      <option value="">—</option>
                      <option value="f">{t.female}</option>
                      <option value="m">{t.male}</option>
                    </select>
                  </label>

                  <label>
                    <Lbl>{t.citizenship}</Lbl>
                    <input name="nationality" list="revio-countries" defaultValue={r.nationality} className={input} placeholder="BG" maxLength={2} />
                  </label>
                  <label>
                    <Lbl hint={t.personalNumberHint}>{t.personalNumber}</Lbl>
                    <input name="personalId" defaultValue={r.personalId ?? ""} className={input} placeholder="—" />
                  </label>
                  <label>
                    <Lbl>{t.documentType}</Lbl>
                    <select name="documentType" defaultValue={r.documentType ?? ""} className={input}>
                      <option value="">—</option>
                      <option value="id_card">{t.docTypes.id_card}</option>
                      <option value="passport">{t.docTypes.passport}</option>
                      <option value="other">{t.docTypes.other}</option>
                    </select>
                  </label>
                  <label>
                    <Lbl>{t.documentNumber}</Lbl>
                    <input name="documentNumber" defaultValue={r.documentNumber ?? ""} className={input} placeholder="641234567" />
                  </label>
                  <label>
                    <Lbl hint={!known ? t.seriesHint.unknown : needsSeries ? t.seriesHint.required : t.seriesHint.notNeeded}>{t.documentSeries}</Lbl>
                    <input name="documentSeries" defaultValue={r.documentSeries ?? ""} className={input} placeholder="—" />
                  </label>

                  <label>
                    <Lbl>{t.issuedBy}</Lbl>
                    <input name="documentCountry" list="revio-countries" defaultValue={r.documentCountry ?? ""} className={input} placeholder="BG" maxLength={2} />
                  </label>
                  <div>
                    <Lbl>{t.roomFloor}</Lbl>
                    {/* Read-only: a snapshot of where this person actually slept, taken at check-in. */}
                    <p className="flex h-9 items-center text-[13px] font-semibold text-ink-700">
                      {r.unitLabel ?? "—"}{r.floor ? ` · ${r.floor}` : ""}
                    </p>
                  </div>
                  <label className="col-span-2 flex items-end gap-2 pb-1.5">
                    <input type="checkbox" name="touristPackage" defaultChecked={r.touristPackage} className="h-4 w-4 rounded border-surface-border" />
                    <span className="text-[12.5px] text-ink-700">{t.touristPackage}</span>
                  </label>
                </div>

                {problems.length > 0 && (
                  <ul className="mt-3 space-y-0.5">
                    {/* One line per rule, not per field: a name in the wrong script fails on first
                        AND family name, and the same sentence twice reads as a glitch. */}
                    {[...new Set(problems.map((p) => t.problems[p.code] ?? p.message))].map((m) => (
                      <li key={m} className="text-[11.5px] text-warning-700">· {m}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                  {blank && (
                    <SubmitButton formAction={removeStayGuest}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-400 transition-colors hover:text-danger-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t.remove}
                    </SubmitButton>
                  )}
                  {!blank && (
                    <SubmitButton formAction={cancelStayGuest}
                      title={r.cancelled ? t.reinstateTitle : t.cancelTitle}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-400 transition-colors hover:text-warning-700"
                    >
                      {r.cancelled
                        ? <><RotateCcw className="h-3.5 w-3.5" /> {t.reinstate}</>
                        : <><Ban className="h-3.5 w-3.5" /> {t.cancel}</>}
                    </SubmitButton>
                  )}
                  <SubmitButton className="rounded-md bg-brand-700 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800">
                    {t.save}
                  </SubmitButton>
                </div>
              </form>
            </details>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-surface-border/60 px-4 py-2.5">
          <p className="text-[11.5px] text-ink-400">
            {t.keptFor}
          </p>
          <form action={addStayGuest}>
            <input type="hidden" name="reservationId" value={reservationId} />
            <SubmitButton className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700" pendingLabel={t.adding}>
              <Plus className="h-3.5 w-3.5" /> {t.addGuest}
            </SubmitButton>
          </form>
        </div>
      )}

      {/* One list for every country field on the card. Suggestions only — any code can be typed. */}
      <datalist id="revio-countries">
        {Object.keys(COUNTRY_NAMES).map((code) => (
          <option key={code} value={code}>{countryName(code)}</option>
        ))}
      </datalist>
    </Card>
  );
}
