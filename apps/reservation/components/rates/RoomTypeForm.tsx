"use client";

import { translate } from "@revio/ui/i18n";
import { useLocale } from "@revio/ui/i18n-context";
import { rates as ratesDict } from "@/lib/i18n/rates";

import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BED_SETUPS, ROOM_AMENITIES, ROOM_AMENITY_GROUPS } from "@revio/core";
import { AmenityIcon } from "@revio/ui/amenity-icon";
import { Card, CardHeader } from "@revio/ui/primitives";
import { saveRoomType, type ActionResult } from "@/lib/actions-rates";
import { Field, inputCls } from "@/components/ui/Modal";

export type RoomTypeValues = {
  id: string; name: string; code: string; unitKind: string;
  totalRooms: number; maxGuests: number; defaultOccupancy: number | null; description: string | null; active: boolean;
  sizeSqm: number | null; bedSetup: string | null; amenities: string[];
};

/**
 * The fields of a room type — one set, used by the "Add room type" dialog and by the room's own page,
 * so the two can never ask different questions. Split in two halves on purpose: what the hotel SELLS
 * (the basics) and what a GUEST READS (all optional, improved later).
 */
export function RoomTypeBasicsFields({ roomType }: { roomType?: RoomTypeValues }) {
  const f = translate(ratesDict, useLocale()).roomForm;
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={f.name}><input name="name" defaultValue={roomType?.name} required className={inputCls} placeholder={f.namePlaceholder} /></Field>
        <Field label={f.code} hint={f.codeHint}><input name="code" defaultValue={roomType?.code} required className={inputCls} placeholder="DDR" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={f.unitKind}>
          <select name="unitKind" defaultValue={roomType?.unitKind ?? "room"} className={inputCls}>
            <option value="room">{f.unitKinds.room}</option>
            <option value="apartment">{f.unitKinds.apartment}</option>
            <option value="bed">{f.unitKinds.bed}</option>
          </select>
        </Field>
        <Field label={f.physical} hint={f.physicalHint}><input name="totalRooms" type="number" min={0} defaultValue={roomType?.totalRooms ?? 0} className={inputCls} /></Field>
        <Field label={f.maxGuests}><input name="maxGuests" type="number" min={1} defaultValue={roomType?.maxGuests ?? 2} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={f.normally} hint={f.normallyHint}>
          <input name="defaultOccupancy" type="number" min={1} defaultValue={roomType?.defaultOccupancy ?? ""} className={inputCls} placeholder="—" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
        <input type="checkbox" name="active" defaultChecked={roomType?.active ?? true} className="h-4 w-4 rounded border-surface-border text-brand-600" /> {f.active}
      </label>
    </div>
  );
}

export function RoomTypeGuestFields({ roomType }: { roomType?: RoomTypeValues }) {
  const s = translate(ratesDict, useLocale());
  const f = s.roomForm;
  return (
    <div className="space-y-3.5">
      <Field label={f.description} hint={f.descriptionHint}>
        <textarea
          name="description"
          defaultValue={roomType?.description ?? ""}
          rows={3}
          className={`${inputCls} resize-y`}
          placeholder={f.descriptionPlaceholder}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={f.size} hint={f.sizeHint}>
          <input name="sizeSqm" type="number" min={0} max={2000} defaultValue={roomType?.sizeSqm ?? ""} className={inputCls} placeholder={f.sizePlaceholder} />
        </Field>
        <Field label={f.beds}>
          <select name="bedSetup" defaultValue={roomType?.bedSetup ?? ""} className={inputCls}>
            <option value="">{f.bedsNone}</option>
            {BED_SETUPS.map((b) => <option key={b.key} value={b.key}>{s.bedSetups[b.key] ?? b.label}</option>)}
          </select>
        </Field>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold text-ink-700">{f.amenities}</div>
        {/*
          Toggle chips with icons, not a column of tick boxes: thirty-five checkboxes is a wall of
          near-identical rows, and a chip that visibly fills in shows what is on without tracing a
          line back to a small square. The real <input> is still there under `sr-only` — the form
          posts the same field, and it stays keyboard-reachable and readable by a screen reader.
        */}
        <div className="space-y-2.5">
          {ROOM_AMENITY_GROUPS.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">{s.amenityGroups[g.key] ?? g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_AMENITIES.filter((a) => a.group === g.key).map((a) => (
                  <label key={a.key} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="amenities"
                      value={a.key}
                      defaultChecked={roomType?.amenities?.includes(a.key) ?? false}
                      className="peer sr-only"
                    />
                    <span className="flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-2.5 py-1 text-[12px] text-ink-500 transition-colors hover:border-ink-300 peer-checked:border-product-ink peer-checked:bg-product-wash peer-checked:font-semibold peer-checked:text-product-ink peer-focus-visible:ring-2 peer-focus-visible:ring-product-ink/40">
                      <AmenityIcon name={a.icon} size={13} />
                      {s.amenities[a.key] ?? a.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One tab of a room type's page — the basics, or what a guest reads — as one card whose save button
 * is its last line. `section` tells `saveRoomType` which half this form carries, so saving one tab
 * never touches the other's fields.
 */
export function RoomTypeSectionForm({ roomType, section }: { roomType: RoomTypeValues; section: "basics" | "content" }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(saveRoomType, null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => { if (state?.ok) setSavedAt(Date.now()); }, [state]);
  const basics = section === "basics";
  const f = translate(ratesDict, useLocale()).roomForm;

  return (
    <form action={formAction} onChange={() => setSavedAt(null)}>
      <input type="hidden" name="id" value={roomType.id} />
      <input type="hidden" name="section" value={section} />
      <Card>
        <CardHeader
          title={basics ? f.basicsTitle : f.guestTitle}
          subtitle={basics ? f.basicsSubtitle : f.guestSubtitle}
        />
        <div className="px-5 pb-5">{basics ? <RoomTypeBasicsFields roomType={roomType} /> : <RoomTypeGuestFields roomType={roomType} />}</div>
        {/* The card's own last line. Sticky on the long tab (thirty-five amenity chips) so saving is in
            reach from anywhere in it, and it stops at the card's end — nothing follows it. */}
        <SaveFooter sticky={!basics} pending={pending} error={state?.error} saved={!!savedAt && !state?.error} />
      </Card>
    </form>
  );
}

export function SaveFooter({ sticky, pending, error, saved }: { sticky?: boolean; pending: boolean; error?: string | undefined; saved: boolean }) {
  const t = translate(ratesDict, useLocale()).save;
  return (
    <div className={`flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t border-surface-border bg-white px-5 py-3 ${sticky ? "sticky bottom-0 z-10" : ""}`}>
      {error && <p className="mr-auto text-[12.5px] font-medium text-danger-600">{error}</p>}
      {saved && <p className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-success-600"><Check className="h-4 w-4" /> {t.saved}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-brand-800 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
        {pending ? t.saving : t.saveChanges}
      </button>
    </div>
  );
}
