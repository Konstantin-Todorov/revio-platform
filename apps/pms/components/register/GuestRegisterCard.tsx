import { AlertTriangle, Ban, Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  validateRegisterEntry, registerCategory, expectedNameScript, countryName, COUNTRY_NAMES,
  type TouristRegisterEntry,
} from "@revio/core";
import { saveStayGuest, addStayGuest, removeStayGuest, cancelStayGuest } from "@/lib/actions-register";
import { Card, CardHeader, StatusPill } from "@/components/ui/primitives";

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
export function GuestRegisterCard({ reservationId, rows }: { reservationId: string; rows: RegisterRow[] }) {
  const problemsById = new Map(rows.map((r) => [r.id, validateRegisterEntry(r)]));
  const complete = rows.filter((r) => problemsById.get(r.id)!.length === 0).length;

  return (
    <Card className="mt-4">
      <CardHeader
        title="Guest register"
        subtitle="Регистър на настанените туристи · required by law for every guest who stays the night, not only the person who booked"
        action={
          rows.length > 0 ? (
            <StatusPill tone={complete === rows.length ? "success" : "warning"}>
              {complete} of {rows.length} complete
            </StatusPill>
          ) : undefined
        }
      />

      {rows.length === 0 && (
        <p className="px-4 py-6 text-[13px] text-ink-400">
          The register opens at check-in, one entry per guest in the room.
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
                  {named || "Not captured yet"}
                </span>
                {r.cancelled && (
                  <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-400">
                    cancelled
                  </span>
                )}
                <span className="shrink-0 text-[11.5px] text-ink-400">
                  {r.nationality ? countryName(r.nationality) : "—"}
                  {r.unitLabel ? ` · room ${r.unitLabel}` : ""}
                </span>
              </summary>

              <form action={saveStayGuest} className="border-t border-surface-border/40 bg-surface-muted/30 px-4 py-3.5">
                <input type="hidden" name="id" value={r.id} />

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <label>
                    <Lbl hint={!known ? undefined : script === "cyrillic" ? "кирилица" : "latin"}>First name</Lbl>
                    <input name="firstName" defaultValue={r.firstName} className={input} placeholder={known && script === "cyrillic" ? "Мария" : "John"} />
                  </label>
                  <label>
                    <Lbl hint="бащино · often blank">Patronymic</Lbl>
                    <input name="middleName" defaultValue={r.middleName ?? ""} className={input} placeholder="—" />
                  </label>
                  <label>
                    <Lbl hint={!known ? undefined : script === "cyrillic" ? "кирилица" : "latin"}>Family name</Lbl>
                    <input name="lastName" defaultValue={r.lastName} className={input} placeholder={known && script === "cyrillic" ? "Иванова" : "Smith"} />
                  </label>
                  <label>
                    <Lbl>Date of birth</Lbl>
                    <input name="dateOfBirth" type="date" defaultValue={r.dateOfBirth ?? ""} className={input} />
                  </label>
                  <label>
                    <Lbl>Sex</Lbl>
                    <select name="sex" defaultValue={r.sex ?? ""} className={input}>
                      <option value="">—</option>
                      <option value="f">Female</option>
                      <option value="m">Male</option>
                    </select>
                  </label>

                  <label>
                    <Lbl>Citizenship</Lbl>
                    <input name="nationality" list="revio-countries" defaultValue={r.nationality} className={input} placeholder="BG" maxLength={2} />
                  </label>
                  <label>
                    <Lbl hint="ЕГН / ЛЧН">Personal number</Lbl>
                    <input name="personalId" defaultValue={r.personalId ?? ""} className={input} placeholder="—" />
                  </label>
                  <label>
                    <Lbl>Document type</Lbl>
                    <select name="documentType" defaultValue={r.documentType ?? ""} className={input}>
                      <option value="">—</option>
                      <option value="id_card">Лична карта · ID card</option>
                      <option value="passport">Паспорт · Passport</option>
                      <option value="other">Друг · Other</option>
                    </select>
                  </label>
                  <label>
                    <Lbl>Document number</Lbl>
                    <input name="documentNumber" defaultValue={r.documentNumber ?? ""} className={input} placeholder="641234567" />
                  </label>
                  <label>
                    <Lbl hint={!known ? "non-EU/EEA only" : needsSeries ? "required" : "not needed"}>Document series</Lbl>
                    <input name="documentSeries" defaultValue={r.documentSeries ?? ""} className={input} placeholder="—" />
                  </label>

                  <label>
                    <Lbl>Issued by</Lbl>
                    <input name="documentCountry" list="revio-countries" defaultValue={r.documentCountry ?? ""} className={input} placeholder="BG" maxLength={2} />
                  </label>
                  <div>
                    <Lbl>Room · floor</Lbl>
                    {/* Read-only: a snapshot of where this person actually slept, taken at check-in. */}
                    <p className="flex h-9 items-center text-[13px] font-semibold text-ink-700">
                      {r.unitLabel ?? "—"}{r.floor ? ` · ${r.floor}` : ""}
                    </p>
                  </div>
                  <label className="col-span-2 flex items-end gap-2 pb-1.5">
                    <input type="checkbox" name="touristPackage" defaultChecked={r.touristPackage} className="h-4 w-4 rounded border-surface-border" />
                    <span className="text-[12.5px] text-ink-700">Part of a tourist package</span>
                  </label>
                </div>

                {problems.length > 0 && (
                  <ul className="mt-3 space-y-0.5">
                    {problems.map((p) => (
                      <li key={p.field} className="text-[11.5px] text-warning-700">· {p.message}</li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                  {blank && (
                    <button
                      type="submit" formAction={removeStayGuest}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-400 transition-colors hover:text-danger-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                  {!blank && (
                    <button
                      type="submit" formAction={cancelStayGuest}
                      title={r.cancelled ? "Put this registration back" : "Mark this registration cancelled — it keeps its number"}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-400 transition-colors hover:text-warning-700"
                    >
                      {r.cancelled
                        ? <><RotateCcw className="h-3.5 w-3.5" /> Reinstate</>
                        : <><Ban className="h-3.5 w-3.5" /> Cancel</>}
                    </button>
                  )}
                  <button type="submit" className="rounded-md bg-brand-700 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-800">
                    Save
                  </button>
                </div>
              </form>
            </details>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-surface-border/60 px-4 py-2.5">
          <p className="text-[11.5px] text-ink-400">
            Kept for two years. A guest asking to be forgotten has their profile anonymised — the register
            entry stands, because the law requires it.
          </p>
          <form action={addStayGuest}>
            <input type="hidden" name="reservationId" value={reservationId} />
            <button type="submit" className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">
              <Plus className="h-3.5 w-3.5" /> Add a guest
            </button>
          </form>
        </div>
      )}

      {/* One list for every country field on the card. Suggestions only — any code can be typed. */}
      <datalist id="revio-countries">
        {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </datalist>
    </Card>
  );
}
