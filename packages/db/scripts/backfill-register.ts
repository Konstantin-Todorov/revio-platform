/**
 * Open register entries for guests who were already in the building when the register shipped.
 *
 * ONLY stays that are currently in house, and that is the whole design decision.
 *
 * A departed stay cannot be registered after the fact: the guest is gone, their document went with
 * them, and the entry could never be completed. Creating a blank row for one would not be
 * compliance, it would be manufacturing a permanent, visible failure — a register full of entries
 * nobody can ever finish reads worse to an inspector than a register that starts on the day the
 * property began keeping it. A guest still in the building can still be asked for a passport, so
 * those rows are worth opening.
 *
 * `registeredAt` is the ACTUAL check-in instant, not now. The register records when somebody was
 * accommodated, and stamping today's date on a guest who arrived on Tuesday would be a false entry
 * in the one column that orders the whole thing.
 *
 * Idempotent: a stay that already has entries is skipped, so this is safe to re-run.
 *
 *   pnpm --filter @revio/db exec tsx scripts/backfill-register.ts [--apply]
 *
 * Dry by default. Prints what it would do and changes nothing until --apply.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function splitName(raw: string): { firstName: string | null; middleName: string | null; lastName: string | null } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, middleName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, middleName: null, lastName: null };
  return {
    firstName: parts[0]!,
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts[parts.length - 1]!,
  };
}

async function main() {
  const stays = await prisma.reservation.findMany({
    where: {
      departedAt: null,
      assignments: { some: { status: "active", checkedInAt: { not: null }, checkedOutAt: null } },
      stayGuests: { none: {} },
    },
    include: {
      lines: { select: { id: true, guestsCount: true } },
      assignments: {
        where: { status: "active", checkedOutAt: null, checkedInAt: { not: null } },
        include: { unit: { select: { label: true, floor: true } } },
      },
    },
    // Oldest arrival first, so пореден номер runs in the order people actually arrived rather than
    // in whatever order the database returned them.
    orderBy: { importedAt: "asc" },
  });

  console.log(`${stays.length} in-house stay(s) with no register entries.`);
  if (stays.length === 0) return;

  let created = 0;
  for (const r of stays) {
    const arrival = r.assignments
      .map((a) => a.checkedInAt!)
      .sort((x, y) => x.getTime() - y.getTime())[0] ?? new Date();

    // One row per person per assigned room. `guestsCount` lives on the line, so the room is matched
    // through it — a two-room stay must not put both parties in the first room.
    const specs = r.assignments.map((a) => ({
      unitLabel: a.unit.label,
      floor: a.unit.floor,
      people: Math.max(1, r.lines.find((l) => l.id === a.reservationLineId)?.guestsCount ?? 1),
    }));
    const total = specs.reduce((n, s) => n + s.people, 0);

    console.log(
      `  ${r.guestName} · ${specs.map((s) => s.unitLabel).join(", ")} · ` +
      `${total} entr${total === 1 ? "y" : "ies"} · registered ${arrival.toISOString().slice(0, 16).replace("T", " ")}`,
    );
    if (!APPLY) { created += total; continue; }

    await prisma.$transaction(async (tx) => {
      const again = await tx.stayGuest.count({ where: { reservationId: r.id } });
      if (again > 0) return;

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${r.propertyId}, 0))`;
      const rows = await tx.$queryRaw<{ next: bigint | number | null }[]>`
        SELECT COALESCE(MAX("registerNo"), 0) + 1 AS next FROM "StayGuest" WHERE "propertyId" = ${r.propertyId}
      `;
      let next = Number(rows[0]?.next ?? 1);
      let first = true;

      for (const spec of specs) {
        for (let i = 0; i < spec.people; i++) {
          await tx.stayGuest.create({
            data: {
              tenantId: r.tenantId, propertyId: r.propertyId, reservationId: r.id,
              guestId: first ? r.guestId : null,
              registerNo: next++,
              registeredAt: arrival,
              ...(first ? splitName(r.guestName) : {}),
              unitLabel: spec.unitLabel, floor: spec.floor,
            },
          });
          first = false;
          created++;
        }
      }
    });
  }

  console.log(
    APPLY
      ? `\n✓ ${created} register entr${created === 1 ? "y" : "ies"} opened. Every one is INCOMPLETE — ` +
        `the documents still have to be captured while these guests are in the building.`
      : `\nDry run — ${created} entr${created === 1 ? "y" : "ies"} would be opened. Re-run with --apply.`,
  );
}

main().finally(() => prisma.$disconnect());
