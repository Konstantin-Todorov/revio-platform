/**
 * Two connectivity faults on real client accounts, both open since 2026-09-20.
 *
 * Run with no argument to inspect; `--apply` to write. Read the two cases before running either.
 *
 * ## Why a script and not the screens
 *
 * Both fixes belong on a screen, and one of them has no control: there is no "clear this mapping"
 * in the console, only the hotel's own Mapping dialog, which needs the hotel's login. The operator
 * console does have the channel controls — but reaching production's console means signing in as
 * the founder, and a password is not something to hand around. So this does exactly what those two
 * controls do, by name, with the same audit rows, and nothing else.
 *
 * ## ⚠️ Nothing here sends anything to an OTA
 *
 * That is deliberate and it is the reason this is safe to run unattended.
 *
 * `updateStreamMapping` normally ends in `recordPush` → `syncRealChannels`, a real push to
 * Booking.com. Here it would carry no new information: the plan being unmapped is switched OFF, and
 * `syncChannel` has skipped switched-off plans since 2026-09-17, so it is already absent from every
 * push. A no-op push to a live hotel's distribution is still traffic against a real OTA connection,
 * and there is no reason to send one.
 *
 * `disconnectChannel` normally calls Channex to switch the far end off. Ventsi's channel has no
 * `externalChannelId` at all — nothing was ever created there — so `switchOffAtChannel` would
 * return early without a call even if it ran. It also pushes a stop-sell overlay first, which for a
 * property Channex has deleted can only fail. Neither is worth doing to reach the same end state.
 *
 * ## Case 1 — DesManagement 2015 · Cabacum Beach Residence
 *
 * `Apartment, 2 Bedrooms · Standard Rate` is switched off in the product and still carries a
 * Channex rate id. That id, read from Channex on 2026-09-22, is
 * `BB BAR - BookingCom Cabacum Beach Residence` attached to `Apartment, 1 Bedroom` — so the row is
 * wrong twice over: wrong room, and a channel-DERIVED plan where every other row on this property
 * points at a base plan. Six of the seven mappings are correct and are not touched.
 *
 * Unmapped, not deleted — `externalRateId: null`, `status: "incomplete"` — which is precisely what
 * the hotel's own dialog does when somebody picks "— not mapped —". The row keeps the pairing
 * visible on the screen and a later remap has something to edit.
 *
 * ## Case 2 — Ventsi Group · Chervena Vila
 *
 * The channel reads `connected` and points at Channex property `d06f812c-…`, which is not in the
 * account: the three properties there on 2026-09-22 are Cabacum Beach Residence and two called
 * Ethno Villa Cherry. Nothing can be sent and nothing can arrive. The tenant is suspended, so it
 * has not been syncing anyway, and it has never produced a reservation.
 *
 * Disconnected, not removed. `operatorDeleteChannel` exists for this shape of case and its own
 * comment says so — but delete is permanent and `Reservation.channel` cascades, while disconnect is
 * reversible and keeps both mappings dormant. The account's future is a decision nobody has made;
 * this only stops the record claiming a connection that does not exist.
 *
 * ⚠️ Reconnecting will NOT work until a Channex property exists again. That is the truth of the
 * situation rather than a limitation of this script: the property was deleted at Channex.
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

/** Every read and write here is operator-perimeter, across tenants. */
async function bypass<T>(fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe("SET app.bypass = 'on'");
  return fn();
}

function line(label: string, value: string) {
  console.log(`  ${label.padEnd(26)} ${value}`);
}

await bypass(async () => {
  console.log(`\n=== Real-client connectivity repair — ${APPLY ? "APPLYING" : "DRY RUN"} ===\n`);

  // ---- Case 1 -------------------------------------------------------------
  const stale = await prisma.channelRatePlanMapping.findMany({
    where: { externalRateId: { not: null }, ratePlan: { active: false } },
    include: {
      ratePlan: { select: { name: true, active: true } },
      roomType: { select: { name: true } },
      channel: { select: { id: true, name: true, propertyId: true, tenantId: true, property: { select: { name: true, tenant: { select: { name: true, isDemo: true } } } } } },
    },
  });

  console.log(`Case 1 — rate mappings on a switched-off plan: ${stale.length}`);
  for (const m of stale) {
    const t = m.channel.property.tenant;
    line("client", `${t.name}${t.isDemo ? " (demo)" : ""}`);
    line("property", m.channel.property.name);
    line("mapping", `${m.roomType?.name ?? "(all rooms)"} · ${m.ratePlan.name}`);
    line("plan is active", String(m.ratePlan.active));
    line("externalRateId now", String(m.externalRateId));
    line("→ becomes", "null, status incomplete");

    if (!APPLY) { console.log(); continue; }

    await prisma.$transaction([
      prisma.channelRatePlanMapping.update({
        where: { id: m.id },
        data: { externalRateId: null, status: "incomplete" },
      }),
      prisma.auditEntry.create({
        data: {
          tenantId: m.channel.tenantId,
          propertyId: m.channel.propertyId,
          userId: null,
          entity: `Mapping · ${m.channel.name} · ${m.roomType?.name ?? "(all rooms)"} · ${m.ratePlan.name}`,
          field: "rate mapping",
          oldValue: m.externalRateId,
          newValue: "incomplete",
          // Not "manual": nobody pressed anything. The word has to be true for the log to be worth reading.
          source: "operator-repair",
          channelCode: m.channel.name,
          syncResult: "success",
        },
      }),
    ]);
    console.log("  ✔ unmapped\n");
  }

  // ---- Case 2 -------------------------------------------------------------
  const dead = await prisma.channel.findMany({
    where: { catalogueStatus: "property_missing", status: { not: "disconnected" } },
    include: { property: { select: { name: true, tenant: { select: { name: true, status: true, isDemo: true } } } }, _count: { select: { reservations: true } } },
  });

  console.log(`Case 2 — channels pointing at a property the channel has deleted: ${dead.length}`);
  for (const c of dead) {
    const t = c.property.tenant;
    line("client", `${t.name} (${t.status})${t.isDemo ? " demo" : ""}`);
    line("property", c.property.name);
    line("channex property", String(c.externalPropertyId));
    line("externalChannelId", c.externalChannelId ?? "none — nothing was created there");
    line("reservations", String(c._count.reservations));
    line("status now", c.status);
    line("→ becomes", "disconnected (mappings kept dormant)");

    /*
     * ⚠️ Refuses rather than guesses when a booking exists.
     *
     * Disconnect itself is safe with reservations — it is delete that cascades. But a channel that
     * has produced bookings and now points at nothing is a DIFFERENT situation from this one, and
     * it deserves somebody looking at it rather than a script deciding.
     */
    if (c._count.reservations > 0) {
      console.log("  ✖ skipped — this channel has produced reservations; look at it by hand\n");
      continue;
    }
    if (!APPLY) { console.log(); continue; }

    await prisma.$transaction([
      prisma.channel.update({ where: { id: c.id }, data: { status: "disconnected" } }),
      prisma.syncEvent.create({
        data: {
          tenantId: c.tenantId, propertyId: c.propertyId, channelId: c.id, kind: "push", status: "warning",
          summary: `Channel disconnected — ${c.name} pointed at a property the channel has deleted, so nothing could be sent or received. Mappings kept dormant.`,
        },
      }),
      prisma.auditEntry.create({
        data: {
          tenantId: c.tenantId, propertyId: c.propertyId, userId: null,
          entity: `Channel · ${c.name}`, field: "status",
          oldValue: c.status, newValue: "disconnected",
          source: "operator-repair", channelCode: c.name, syncResult: "success",
        },
      }),
    ]);
    console.log("  ✔ disconnected\n");
  }

  if (!APPLY) console.log("Dry run. Nothing was written. Re-run with --apply.\n");
});

await prisma.$disconnect();
