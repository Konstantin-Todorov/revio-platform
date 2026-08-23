-- State-integrity audit — read-only.
--
-- The round-2 principle is that **no record may exist in a state with no available action**. That is
-- a rule about the whole database, not about one screen, and it was discovered the expensive way:
-- by a hotelier finding a folio that said closed and open, settled and owing, at once.
--
-- This finds every record currently in a contradictory state, so the next one is found by running a
-- query rather than by a customer. Each check names the fault and how many rows have it. Zero rows
-- everywhere is the healthy state.
--
--   psql "$DATABASE_PUBLIC_URL" -f packages/db/scripts/state-audit.sql
--
-- SELECTs only. Safe against production, and meant to be run there.

\pset border 2
\echo ''
\echo '=== State-integrity audit ==================================================='
\echo ''

WITH checks AS (

  -- 1. THE ROUND-2 BUG. A stay recorded as departed that still holds a live room assignment. Reads
  --    as in-house, overstays a night more every night, and accrues nightly charges after leaving.
  SELECT 'departed stay still holding a live room' AS fault, count(*)::int AS rows,
         'repair-stuck-stays.sql' AS remedy
  FROM "Reservation" r
  WHERE r."departedAt" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "RoomAssignment" a
                WHERE a."reservationId" = r.id AND a.status = 'active' AND a."checkedOutAt" IS NULL)

  -- 2. The same shape before `departedAt` existed: every folio closed, yet the rooms never released.
  UNION ALL
  SELECT 'stay with all folios closed but rooms never released', count(*)::int,
         'repair-stuck-stays.sql'
  FROM "Reservation" r
  WHERE r."departedAt" IS NULL
    AND EXISTS (SELECT 1 FROM "RoomAssignment" a
                WHERE a."reservationId" = r.id AND a.status = 'active' AND a."checkedOutAt" IS NULL)
    AND EXISTS (SELECT 1 FROM "Folio" f WHERE f."reservationId" = r.id)
    AND NOT EXISTS (SELECT 1 FROM "Folio" f WHERE f."reservationId" = r.id AND f.status = 'open')

  -- 3. A cancelled booking still occupying a physical room. The room is back on sale (cancelling
  --    restores availability) while the PMS believes somebody is in it — a double-booking waiting
  --    to happen. The CRS now refuses this; an OTA-initiated cancellation can still produce it.
  UNION ALL
  SELECT 'cancelled reservation still occupying a room', count(*)::int,
         'check the guest out in RevioPMS, or release the assignment'
  FROM "Reservation" r
  WHERE r.status = 'cancelled'
    AND EXISTS (SELECT 1 FROM "RoomAssignment" a
                WHERE a."reservationId" = r.id AND a.status = 'active' AND a."checkedOutAt" IS NULL)

  -- 4. A cancelled booking with a bill still open. Fine ONLY if it carries a real charge (a
  --    cancellation fee); an empty one is noise in every unsettled count.
  UNION ALL
  SELECT 'cancelled reservation with an empty open folio', count(*)::int,
         'closes itself on cancel now; existing rows need closing'
  FROM "Folio" f
  JOIN "Reservation" r ON r.id = f."reservationId"
  WHERE r.status = 'cancelled' AND f.status = 'open'
    AND NOT EXISTS (SELECT 1 FROM "FolioLine" l WHERE l."folioId" = f.id AND l.voided = false)

  -- 5. A closed folio that does not say how it ended. Ambiguous about money: settled, forgiven and
  --    still-owed are three different facts and this row states none of them.
  UNION ALL
  SELECT 'closed folio with no recorded outcome', count(*)::int,
         'repair-stuck-stays.sql sets it, or resolve it on the folio screen'
  FROM "Folio" WHERE status = 'closed' AND outcome IS NULL

  -- 6. A folio marked settled that still owes money. The label and the arithmetic disagree, and the
  --    label is the one people read.
  UNION ALL
  SELECT 'folio marked settled that still carries a balance', count(*)::int,
         'reopen and resolve it on the folio screen'
  FROM "Folio" f
  WHERE f.outcome IN ('settled', 'paid_offsystem', 'written_off')
    AND COALESCE((SELECT sum(CASE WHEN l.kind = 'payment' THEN -l."amountMinor" ELSE l."amountMinor" END)
                  FROM "FolioLine" l WHERE l."folioId" = f.id AND l.voided = false), 0) <> 0

  -- 7. A departed stay whose bill is still open. The guest has gone; nobody will settle it at the
  --    desk. It belongs in receivables, which only lists CLOSED folios.
  UNION ALL
  SELECT 'departed stay with a folio still open', count(*)::int,
         'close it from the folio screen so it reaches receivables'
  FROM "Folio" f
  JOIN "Reservation" r ON r.id = f."reservationId"
  WHERE r."departedAt" IS NOT NULL AND f.status = 'open'

  -- 8. A genuine overstay: past departure, never checked out, nobody has acted. Not corruption —
  --    real operational debt, and the thing the exception strip exists to surface.
  UNION ALL
  SELECT 'genuinely overstayed (past departure, never checked out)', count(*)::int,
         'front desk: check them out, or extend the stay'
  FROM "Reservation" r
  WHERE r."departedAt" IS NULL AND r.status IN ('confirmed', 'modified', 'overbooked')
    AND EXISTS (SELECT 1 FROM "RoomAssignment" a
                WHERE a."reservationId" = r.id AND a.status = 'active' AND a."checkedOutAt" IS NULL
                  AND a."checkOut" < CURRENT_DATE)

  -- 9. Two live assignments on one room over the same nights. Two guests, one door.
  UNION ALL
  SELECT 'room double-assigned over overlapping nights', count(*)::int,
         'front desk: move one of them'
  FROM (
    SELECT a1.id
    FROM "RoomAssignment" a1
    JOIN "RoomAssignment" a2
      ON a2."unitId" = a1."unitId" AND a2.id <> a1.id
     AND a1."checkIn" < a2."checkOut" AND a2."checkIn" < a1."checkOut"
    WHERE a1.status = 'active' AND a1."checkedOutAt" IS NULL
      AND a2.status = 'active' AND a2."checkedOutAt" IS NULL
  ) dupes

  -- 10. A folio line on a closed folio, posted after it closed. Charges arriving on a settled bill
  --     is what the round-2 stay did for 41 nights.
  UNION ALL
  SELECT 'charge posted to a folio after it was closed', count(*)::int,
         'void the line, or reopen and resolve the folio'
  FROM "FolioLine" l
  JOIN "Folio" f ON f.id = l."folioId"
  WHERE f.status = 'closed' AND f."closedAt" IS NOT NULL
    AND l."postedAt" > f."closedAt" AND l.voided = false
)
SELECT fault, rows, CASE WHEN rows = 0 THEN 'ok' ELSE remedy END AS remedy
FROM checks
ORDER BY rows DESC, fault;

\echo ''
\echo 'Zero rows in every line is the healthy state. Anything else is a record a hotelier can reach.'
\echo ''
