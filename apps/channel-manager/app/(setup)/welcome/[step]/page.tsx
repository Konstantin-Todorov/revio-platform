import { redirect } from "next/navigation";
import Link from "next/link";
import { welcomeFlow, skippedForSize, totalRooms as sumRooms, isSmallProperty } from "@revio/core";
import { WelcomeShell, WelcomeContinue } from "@revio/ui/welcome-shell";
import { prisma } from "@/lib/db";
import { getProperty } from "@/lib/data";
import { BrandForm, PriceForm, PropertyForm, RoomTypeForm } from "@/components/welcome/WelcomeForms";
import { finishWelcome, finishWelcomeRooms, removeWelcomeRoomType, skipWelcomeStep } from "@/lib/actions-welcome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up RevioLink" };

const PRODUCT = "RevioLink";

export default async function WelcomeStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const property = await getProperty();

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: property.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, code: true, totalRooms: true, maxGuests: true },
  });
  const rooms = sumRooms(roomTypes);
  const steps = welcomeFlow(PRODUCT, rooms);

  // A URL naming a step this property never sees (or a typo) goes to the start rather than 404ing —
  // someone mid-setup should never hit a dead end.
  if (!steps.some((s) => s.key === step)) redirect(`/welcome/${steps[0]!.key}`);
  const current = steps.find((s) => s.key === step)!;
  const shellSteps = steps.map((s) => ({ key: s.key, title: s.title }));

  return (
    <WelcomeShell
      productName={PRODUCT}
      steps={shellSteps}
      currentKey={current.key}
      title={current.title}
      lead={current.lead}
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
      {step === "property" && (
        <PropertyForm
          name={property.name}
          timezone={property.timezone}
          baseCurrency={property.baseCurrency}
          checkOutTime={property.checkOutTime}
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
                {rooms} room{rooms === 1 ? "" : "s"} in total.{" "}
                {isSmallProperty(rooms)
                  ? "We'll keep the rest of setup short and use sensible defaults."
                  : "We'll ask a few more questions — at this size somebody usually owns the answers."}
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

      {step === "golive" && <GoLive rooms={rooms} skipped={skippedForSize(PRODUCT, rooms)} property={property} />}
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
}: {
  rooms: number;
  skipped: string[];
  property: { baseCurrency: string; timezone: string; checkOutTime: string };
}) {
  const channels = await prisma.channel.count({ where: { propertyId: (await getProperty()).id, status: { not: "disconnected" } } });

  return (
    <div className="space-y-6">
      <dl className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white text-[13.5px]">
        {[
          ["Rooms", `${rooms} across your room types`],
          ["Currency", property.baseCurrency],
          ["Time zone", property.timezone],
          ["Check-out", property.checkOutTime],
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
          <strong className="text-ink-900">
            {skipped
              .map((s) => (s === "taxes" ? "taxes and fees" : "adding your team"))
              .join(" or ")}
          </strong>
          . {skipped.length === 1 ? "It is" : "They are"} on your dashboard checklist whenever you want{" "}
          {skipped.length === 1 ? "it" : "them"}.
        </p>
      )}

      {channels === 0 ? (
        <div className="space-y-3">
          <p className="text-[14px] text-ink-700">
            Nothing has left Revio yet. Connect your first channel to start sending availability and
            prices to it.
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
