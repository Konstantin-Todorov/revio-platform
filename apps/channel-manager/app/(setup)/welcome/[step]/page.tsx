import { redirect } from "next/navigation";
import Link from "next/link";
import { inheritedSteps, previousStep, skippedForSize, welcomeFlow } from "@revio/core";
import { SharedSummary, WelcomeContinue, WelcomeShell } from "@revio/ui/welcome-shell";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { getWelcomeFactsForProperty } from "@/lib/welcome";
import { BrandForm, DeliveryForm, PriceForm, PropertyForm, RoomTypeForm } from "@/components/welcome/WelcomeForms";
import {
  finishWelcome,
  finishWelcomeRooms,
  removeWelcomeRoomType,
  skipWelcomeStep,
} from "@/lib/actions-welcome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up RevioLink" };

const PRODUCT = "RevioLink";

export default async function WelcomeStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const property = await getProperty();
  const facts = await getWelcomeFactsForProperty();
  const steps = welcomeFlow(PRODUCT, facts);

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, code: true, totalRooms: true, maxGuests: true },
  });

  // A URL naming a step this property never sees (or a typo) goes to the start rather than 404ing —
  // someone mid-setup should never hit a dead end.
  if (!steps.some((s) => s.key === step)) redirect(`/welcome/${steps[0]!.key}`);
  const current = steps.find((s) => s.key === step)!;
  const back = previousStep(steps, step);

  return (
    <WelcomeShell
      productName={PRODUCT}
      steps={steps.map((s) => ({ key: s.key, title: s.title }))}
      currentKey={current.key}
      title={current.title}
      lead={current.lead}
      {...(back ? { backHref: `/welcome/${back.key}` } : {})}
      footnote={
        current.skippable ? (
          <form action={skipWelcomeStep}>
            <input type="hidden" name="from" value={current.key} />
            <button
              type="submit"
              className="text-[13px] font-semibold text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
            >
              I&rsquo;ll do this later
            </button>
            <span className="ml-2 text-[12.5px] text-ink-400">— it stays on your checklist.</span>
          </form>
        ) : undefined
      }
    >
      {step === "shared" && (
        <div className="space-y-5">
          <SharedSummary items={inheritedSteps(PRODUCT, facts)} />
          <form action={skipWelcomeStep}>
            <input type="hidden" name="from" value="shared" />
            <WelcomeContinue label="Continue" />
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
                    {rt.totalRooms} room{rt.totalRooms === 1 ? "" : "s"} · sleeps {rt.maxGuests}
                  </span>
                  <form action={removeWelcomeRoomType}>
                    <input type="hidden" name="id" value={rt.id} />
                    <button type="submit" className="text-[12.5px] font-semibold text-ink-400 hover:text-danger-600">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <RoomTypeForm />

          {roomTypes.length > 0 && (
            <form action={finishWelcomeRooms} className="pt-1">
              <p className="mb-3 text-[12.5px] text-ink-500">
                {facts.rooms} room{facts.rooms === 1 ? "" : "s"} in total.
              </p>
              <WelcomeContinue label="Continue" />
            </form>
          )}
        </div>
      )}

      {step === "prices" && <PriceForm currency={property.baseCurrency} roomTypeCount={roomTypes.length} />}

      {step === "brand" && (
        <BrandForm
          propertyName={property.name}
          senderName={property.emailSenderName}
          brandColor={property.emailBrandColor}
          logoUrl={property.emailLogoUrl}
        />
      )}

      {step === "delivery" && <DeliveryForm suggested={property.contactEmail} />}

      {step === "team" && (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-700">
            Everyone who works with distribution gets their own login, and sets their own password from
            an invitation. Nobody ever shares one.
          </p>
          <Link
            href="/users"
            className="inline-flex h-11 items-center rounded-md bg-brand-800 px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Invite your team
          </Link>
        </div>
      )}

      {step === "golive" && (
        <GoLive
          rooms={facts.rooms}
          skipped={skippedForSize(PRODUCT, facts)}
          property={property}
          propertyId={property.id}
        />
      )}
    </WelcomeShell>
  );
}

/**
 * The last screen. It states what was decided on their behalf before it offers the switch, because a
 * default nobody can see is not a default — it is a surprise waiting for the first invoice.
 */
async function GoLive({
  rooms,
  skipped,
  property,
  propertyId,
}: {
  rooms: number;
  skipped: string[];
  property: { baseCurrency: string; timezone: string; checkInTime: string; checkOutTime: string };
  propertyId: string;
}) {
  const channels = await prisma.channel.count({
    where: { propertyId, status: { not: "disconnected" } },
  });

  return (
    <div className="space-y-6">
      <dl className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white text-[13.5px]">
        {[
          ["Rooms", `${rooms} across your room types`],
          ["Currency", property.baseCurrency],
          ["Time zone", property.timezone],
          ["Check-in / out", `${property.checkInTime} — ${property.checkOutTime}`],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center gap-4 px-4 py-2.5">
            <dt className="w-32 shrink-0 text-ink-500">{k}</dt>
            <dd className="font-semibold text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>

      {skipped.length > 0 && (
        <p className="rounded-md border border-surface-border bg-surface-muted px-4 py-3 text-[12.5px] leading-relaxed text-ink-600">
          Because you have {rooms} rooms we kept setup short and didn&rsquo;t ask about{" "}
          <strong className="text-ink-900">adding your team</strong>. It is on your dashboard checklist
          whenever you want it.
        </p>
      )}

      {channels === 0 ? (
        <div className="space-y-3">
          <p className="text-[14px] text-ink-700">
            Nothing has left Revio yet. The Channels screen sets your rooms up for distribution and
            then connects your first OTA — neither step puts anything on sale until you say so.
          </p>
          <Link
            href="/channels"
            className="inline-flex h-11 items-center rounded-md bg-success-600 px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-success-700"
          >
            Connect a channel
          </Link>
          <form action={finishWelcome}>
            <button type="submit" className="text-[13px] font-semibold text-ink-500 underline-offset-2 hover:underline">
              Finish setup without connecting yet
            </button>
          </form>
        </div>
      ) : (
        <form action={finishWelcome} className="space-y-3">
          <p className="text-[14px] text-ink-700">
            {channels} channel{channels === 1 ? "" : "s"} connected. Your rooms and prices go out on the
            next sync.
          </p>
          <WelcomeContinue label="Finish setup" tone="go" />
        </form>
      )}
    </div>
  );
}
