/**
 * Put live stays back on the demo hotels' calendars.
 *
 * ## Why this exists rather than "re-run the seed"
 *
 * ⚠️ `prisma/seed.ts` opens with `TRUNCATE … CASCADE`. Against production that deletes every real
 * client, and the demo tenants live in production **on purpose** (`Tenant.isDemo`) so every
 * rehearsal runs against the real migrations, the real RLS and the real build. So the seed can never
 * be the way to refresh them.
 *
 * ## The problem it fixes, and why it will come back without this file
 *
 * Demo data is written with fixed dates and today keeps moving. On 2026-09-16 the demo hotels had
 * **76 room assignments and not one of them reached today** — the last night was 2026-09-10, six
 * days earlier. Opening RevioPMS to show somebody gave an empty tape chart and an empty front desk.
 * Nothing was broken; there was genuinely nothing to render, and no test can catch that because the
 * data is correct, just old.
 *
 * So this is a re-runnable tool, not a migration: run it whenever the demo has gone quiet.
 *
 * ## What keeps it safe to point at production
 *
 * 1. **`isDemo` is the only selector.** It never reads or writes a tenant without that flag, and it
 *    prints the tenants it matched before it changes anything.
 * 2. **It owns only what it made.** Everything it creates carries the `DEMO-STAY-` external id
 *    prefix, and a re-run deletes exactly those rows first — so running it ten times leaves the same
 *    hotel, not ten times the guests. Hand-made demo history is never touched.
 * 3. **Dry run by default.** `--apply` is required to write, and the write is one transaction.
 *
 * Usage:
 *   DATABASE_URL=… pnpm --filter @revio/db exec tsx scripts/refresh-demo-stays.ts
 *   DATABASE_URL=… pnpm --filter @revio/db exec tsx scripts/refresh-demo-stays.ts --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** Everything this script creates is named with it, and a re-run deletes by it. */
const TAG = "DEMO-STAY-";

const DAY = 86_400_000;
/** Dates are calendar dates: build them at UTC midnight so `@db.Date` round-trips unchanged. */
function dayAt(offset: number): Date {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(utcMidnight + offset * DAY);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The shape of a hotel that is actually running, expressed relative to today.
 *
 * Deliberately not random. A demo has to show the three things a front desk does every morning —
 * somebody leaving, somebody already in, somebody arriving — and it has to show them *every* day the
 * demo is opened, so the offsets are fixed and the dates are computed.
 */
const STAYS = [
  { guest: "Elena Georgieva", from: -3, to: 0, arrived: true, note: "departing today" },
  { guest: "Thomas Müller", from: -2, to: 0, arrived: true, note: "departing today" },
  { guest: "Sarah Whitfield", from: -2, to: 2, arrived: true, note: "in house" },
  { guest: "Marco Rossi", from: -1, to: 3, arrived: true, note: "in house" },
  { guest: "Aiko Tanaka", from: -1, to: 1, arrived: true, note: "in house" },
  { guest: "Petar Dimitrov", from: 0, to: 4, arrived: false, note: "arriving today" },
  { guest: "Claire Dubois", from: 0, to: 2, arrived: false, note: "arriving today" },
  { guest: "James O'Connor", from: 1, to: 5, arrived: false, note: "arriving tomorrow" },
  { guest: "Ana Sousa", from: 2, to: 6, arrived: false, note: "arriving in 2 days" },
  { guest: "Lukas Novák", from: 4, to: 7, arrived: false, note: "arriving in 4 days" },
] as const;

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { isDemo: true },
    select: { id: true, name: true, properties: { select: { id: true, name: true } } },
  });

  if (tenants.length === 0) {
    console.error("No demo tenants. Refusing to touch anything.");
    process.exitCode = 1;
    return;
  }

  console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — demo tenants: ${tenants.map((t) => t.name).join(", ")}\n`);

  for (const tenant of tenants) {
    const property = tenant.properties[0];
    if (!property) {
      console.log(`${tenant.name}: no property, skipped\n`);
      continue;
    }

    const [units, ratePlan, existing] = await Promise.all([
      prisma.unit.findMany({
        where: { tenantId: tenant.id, propertyId: property.id, hkStatus: { not: "out_of_order" } },
        select: { id: true, label: true, roomTypeId: true },
        orderBy: { label: "asc" },
      }),
      prisma.ratePlan.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }),
      prisma.reservation.findMany({
        where: { tenantId: tenant.id, externalId: { startsWith: TAG } },
        select: { id: true, guestName: true },
      }),
    ]);

    if (units.length === 0 || !ratePlan) {
      console.log(`${tenant.name}: ${units.length} unit rows, ratePlan=${!!ratePlan} — skipped\n`);
      continue;
    }

    /*
     * ⚠️ One unit per LABEL, not per row.
     *
     * Hotel Sofia carries two distinct units both labelled "101" inside the same property (and the
     * same for 102–108, and again in the Plovdiv property) — pre-existing demo damage, probably a
     * seed run twice. They are different ids, so putting a guest in each is not a double booking,
     * but the tape chart would show two rows called "101" with a different guest in each, and on a
     * demo that reads as a broken product. Picking the first unit per label sidesteps it without
     * touching anybody's data.
     */
    const byLabel = new Map<string, (typeof units)[number]>();
    for (const u of units) if (!byLabel.has(u.label)) byLabel.set(u.label, u);
    const usable = [...byLabel.values()];

    const planned = STAYS.slice(0, Math.min(STAYS.length, usable.length));
    console.log(`${tenant.name} — ${property.name}`);
    console.log(
      `  ${usable.length} distinct rooms (${units.length} unit rows) · removing ${existing.length} previously generated stay(s)`,
    );
    for (const [i, s] of planned.entries()) {
      console.log(
        `  ${iso(dayAt(s.from))} → ${iso(dayAt(s.to))}  room ${usable[i]!.label.padEnd(6)} ${s.guest.padEnd(18)} ${s.note}`,
      );
    }
    console.log("");

    if (!APPLY) continue;

    await prisma.$transaction(
      async (tx) => {
      // Ours only. Room assignments and lines cascade from the reservation.
      if (existing.length > 0) {
        await tx.reservation.deleteMany({
          where: { tenantId: tenant.id, externalId: { startsWith: TAG } },
        });
      }

      for (const [i, s] of planned.entries()) {
        const unit = usable[i]!;
        const checkIn = dayAt(s.from);
        const checkOut = dayAt(s.to);
        const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / DAY));
        const priceMinor = 11_000 * nights;

        const reservation = await tx.reservation.create({
          data: {
            tenantId: tenant.id,
            propertyId: property.id,
            externalId: `${TAG}${i + 1}`,
            guestName: s.guest,
            status: "confirmed",
            totalMinor: priceMinor,
            currency: "EUR",
            propertyCurrency: "EUR",
            propertyTotalMinor: priceMinor,
            fxRate: 1,
            // A booking taken a few days ago reads as a working hotel; all of them landing in the
            // same second reads as a script, which is exactly what a demo must not look like.
            importedAt: new Date(Date.now() - (i + 1) * 7 * 3_600_000),
            lines: {
              create: [{
                roomTypeId: unit.roomTypeId,
                ratePlanId: ratePlan.id,
                quantity: 1,
                checkIn,
                checkOut,
                priceMinor,
              }],
            },
          },
          select: { id: true, lines: { select: { id: true } } },
        });

        await tx.roomAssignment.create({
          data: {
            tenantId: tenant.id,
            propertyId: property.id,
            reservationId: reservation.id,
            reservationLineId: reservation.lines[0]!.id,
            unitId: unit.id,
            checkIn,
            checkOut,
            status: "active",
            // `checkedInAt` is what makes a stay read as in-house rather than expected, and the
            // front desk's whole morning is the difference between those two.
            checkedInAt: s.arrived ? new Date(checkIn.getTime() + 15 * 3_600_000) : null,
            checkedOutAt: null,
            pinned: false,
          },
        });
        }
      },
      // Prisma's default interactive-transaction budget is 5s, and this is usually run from a
      // laptop against the public proxy: twenty creates at that round trip blew past it and rolled
      // the whole thing back. The work is tiny; it is the latency that is not.
      { timeout: 120_000, maxWait: 30_000 },
    );

    console.log(`  ✓ ${planned.length} stays written for ${tenant.name}\n`);
  }

  if (!APPLY) console.log("Nothing was written. Re-run with --apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
