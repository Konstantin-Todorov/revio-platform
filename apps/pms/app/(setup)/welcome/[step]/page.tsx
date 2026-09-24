import { redirect } from "next/navigation";
import Link from "next/link";
import { inheritedSteps, previousStep, skippedForSize, welcomeFlow } from "@revio/core";
import { SharedSummary, WelcomeContinue, WelcomeShell } from "@revio/ui/welcome-shell";
import { translate } from "@revio/ui/i18n";
import { welcomeStepText, welcomeStrings } from "@revio/ui/welcome-strings";
import { i18n } from "@/lib/i18n/server";
import { welcome, type WelcomePageStrings } from "@/lib/i18n/welcome";
import { prisma } from "@/lib/db";
import { activeProperty } from "@/lib/data";
import { getWelcomeFactsForProperty } from "@/lib/welcome";
import { PropertyForm, RoomTypeForm, TaxForm, UnitsForm } from "@/components/welcome/WelcomeForms";
import {
  finishWelcome,
  finishWelcomeRooms,
  finishWelcomeUnits,
  removeWelcomeRoomType,
  removeWelcomeUnit,
  skipWelcomeStep,
} from "@/lib/actions-welcome";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await i18n()).t(welcome).meta };
}

const PRODUCT = "RevioPMS";

export default async function WelcomeStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const { property } = await activeProperty();
  const facts = await getWelcomeFactsForProperty();
  const steps = welcomeFlow(PRODUCT, facts);

  const [roomTypes, units, defaults, cityTax] = await Promise.all([
    prisma.roomType.findMany({
      where: { propertyId: property.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, totalRooms: true, maxGuests: true },
    }),
    prisma.unit.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: [{ floor: "asc" }, { label: "asc" }],
      select: { id: true, label: true, floor: true, roomType: { select: { name: true } } },
    }),
    prisma.propertyDefaults.findUnique({ where: { propertyId: property.id } }),
    prisma.taxFee.findFirst({
      where: { propertyId: property.id, basis: "per_person", type: "fixed", active: true },
    }),
  ]);

  // A URL naming a step this property never sees (or a typo) goes to the start rather than 404ing.
  if (!steps.some((s) => s.key === step)) redirect(`/welcome/${steps[0]!.key}`);
  const current = steps.find((s) => s.key === step)!;
  const back = previousStep(steps, step);
  const { t: tr, locale } = await i18n();
  const t = tr(welcome);
  const shell = translate(welcomeStrings, locale).shell;
  const text = (s: { key: string; title: string; lead: string }) => welcomeStepText(s.key, PRODUCT, locale, s);

  return (
    <WelcomeShell
      productName={PRODUCT}
      steps={steps.map((s) => ({ key: s.key, title: text(s).title }))}
      currentKey={current.key}
      title={text(current).title}
      lead={text(current).lead}
      locale={locale}
      {...(back ? { backHref: `/welcome/${back.key}` } : {})}
      footnote={
        current.skippable ? (
          <form action={skipWelcomeStep}>
            <input type="hidden" name="from" value={current.key} />
            <button
              type="submit"
              className="text-[13px] font-semibold text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
            >
              {shell.later}
            </button>
            <span className="ml-2 text-[12.5px] text-ink-400">{shell.laterNote}</span>
          </form>
        ) : undefined
      }
    >
      {step === "shared" && (
        <div className="space-y-5">
          <SharedSummary items={inheritedSteps(PRODUCT, facts).map((i) => ({ ...i, title: welcomeStepText(i.key, PRODUCT, locale, { title: i.title, lead: "" }).doneTitle }))} locale={locale} />
          <form action={skipWelcomeStep}>
            <input type="hidden" name="from" value="shared" />
            <WelcomeContinue label={shell.continue} savingLabel={shell.saving} />
          </form>
        </div>
      )}

      {step === "property" && (
        <PropertyForm
          values={{
            name: property.name,
            address: property.address,
            contactEmail: property.contactEmail,
            phone: property.phone,
            timezone: property.timezone,
            baseCurrency: property.baseCurrency,
            checkInTime: property.checkInTime,
            checkOutTime: property.checkOutTime,
          }}
        />
      )}

      {step === "rooms" && (
        <div className="space-y-5">
          {roomTypes.length > 0 && (
            <ul className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white">
              {roomTypes.map((rt) => (
                <li key={rt.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-[13.5px] font-semibold text-ink-900">{rt.name}</span>
                  <span className="tnum text-[12.5px] text-ink-500">
                    {t.roomsLine(rt.totalRooms, rt.maxGuests)}
                  </span>
                  <form action={removeWelcomeRoomType}>
                    <input type="hidden" name="id" value={rt.id} />
                    <button type="submit" className="text-[12.5px] font-semibold text-ink-400 hover:text-danger-600">
                      {t.remove}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <RoomTypeForm />

          {roomTypes.length > 0 && (
            <form action={finishWelcomeRooms} className="pt-1">
              <WelcomeContinue label={shell.continue} savingLabel={shell.saving} />
            </form>
          )}
        </div>
      )}

      {step === "units" && (
        <div className="space-y-5">
          {units.length > 0 && (
            <ul className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white">
              {units.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 text-[13.5px] font-bold text-ink-900">{u.label}</span>
                  <span className="flex-1 text-[12.5px] text-ink-500">
                    {u.roomType.name}
                    {u.floor ? (/^\d+$/.test(u.floor) ? t.floor(u.floor) : ` · ${u.floor}`) : ""}
                  </span>
                  <form action={removeWelcomeUnit}>
                    <input type="hidden" name="id" value={u.id} />
                    <button type="submit" className="text-[12.5px] font-semibold text-ink-400 hover:text-danger-600">
                      {t.remove}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {roomTypes.length > 0 ? (
            <UnitsForm roomTypes={roomTypes.map((rt) => ({ id: rt.id, name: rt.name }))} />
          ) : (
            <p className="rounded-md border border-surface-border bg-surface-muted px-4 py-3 text-[13px] text-ink-600">
              {t.roomTypeFirst}
            </p>
          )}

          {units.length > 0 && (
            <form action={finishWelcomeUnits} className="pt-1">
              <p className="mb-3 text-[12.5px] text-ink-500">
                {t.roomsReady(units.length)}
              </p>
              <WelcomeContinue label={shell.continue} savingLabel={shell.saving} />
            </form>
          )}
        </div>
      )}

      {step === "taxes" && (
        <TaxForm
          values={{
            vatStandardPct: defaults?.vatStandardPct ?? 20,
            vatReducedPct: defaults?.vatReducedPct ?? 9,
            cityTax: cityTax?.amountMinor ? (cityTax.amountMinor / 100).toFixed(2) : "",
            currency: property.baseCurrency,
            invoiceIssuerName: defaults?.invoiceIssuerName ?? null,
            invoiceVatId: defaults?.invoiceVatId ?? null,
            invoiceAddress: defaults?.invoiceAddress ?? property.address,
          }}
        />
      )}

      {step === "team" && (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-700">
            {t.teamBody}
          </p>
          <Link
            href="/users"
            className="inline-flex h-11 items-center rounded-md bg-brand-800 px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {t.addTeam}
          </Link>
        </div>
      )}

      {step === "golive" && (
        <Ready
          units={units.length}
          skipped={skippedForSize(PRODUCT, facts)}
          rooms={facts.rooms}
          property={property}
          t={t}
          saving={shell.saving}
        />
      )}
    </WelcomeShell>
  );
}

/**
 * The last screen. It states what was decided on their behalf before it lets them out, because a
 * default nobody can see is not a default — it is a surprise waiting for the first invoice.
 */
function Ready({
  units,
  rooms,
  skipped,
  property,
  t,
  saving,
}: {
  units: number;
  rooms: number;
  skipped: string[];
  property: { timezone: string; checkInTime: string; checkOutTime: string };
  t: WelcomePageStrings;
  saving: string;
}) {
  return (
    <div className="space-y-6">
      <dl className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white text-[13.5px]">
        {[
          [t.ready.rooms, t.ready.roomsValue(units)],
          [t.ready.timezone, property.timezone],
          [t.ready.checkInOut, `${property.checkInTime} — ${property.checkOutTime}`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center gap-4 px-4 py-2.5">
            <dt className="w-32 shrink-0 text-ink-500">{k}</dt>
            <dd className="font-semibold text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>

      {skipped.length > 0 && (
        <p className="rounded-md border border-surface-border bg-surface-muted px-4 py-3 text-[12.5px] leading-relaxed text-ink-600">
          {t.keptShortBefore(rooms)}{" "}
          <strong className="text-ink-900">{t.addingTeam}</strong>{t.keptShortAfter}
        </p>
      )}

      <p className="text-[14px] text-ink-700">
        {t.readyBody}
      </p>

      <form action={finishWelcome}>
        <WelcomeContinue label={t.finish} savingLabel={saving} tone="go" />
      </form>
    </div>
  );
}
