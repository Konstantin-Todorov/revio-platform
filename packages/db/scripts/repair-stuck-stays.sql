-- Repair stays that were checked out and then checked in again (PMS refinement round 2, §1.3-C).
--
-- The bug: `checkIn` never asked whether a stay had already departed, so a reservation could be
-- checked out cleanly and then checked in again hours later. That left live assignment rows on a
-- stay whose folios were closed, and since "in the house" was derived from those rows, the guest
-- kept overstaying a night more every night and drawing nightly room + extras accruals.
--
-- The code fix (a) refuses the second check-in and (b) records `Reservation.departedAt`. Neither
-- repairs rows that are already wrong, which is what this does.
--
-- WHAT IT DOES NOT DO — deliberately:
--   * It does not void or alter a single money line. The charges that accrued after departure are
--     real rows on a real folio, and deciding whether they are owed, waived or written off is a
--     manager's call with a reason attached (§1.4 gives them four ways to do it). A repair script
--     that quietly edits someone's bill is worse than the bug.
--   * It does not delete the erroneous assignments. They are stamped as checked out at the moment
--     the stay actually ended, so the history still shows that they existed and were wrong.
--   * It touches nothing whose folios are still open — an open folio means the stay may genuinely
--     still be in progress, and this script must never end a stay that is really happening.
--
-- Idempotent: re-running it changes nothing, because the first run leaves no row matching.
--
--   psql "$DATABASE_PUBLIC_URL" -f packages/db/scripts/repair-stuck-stays.sql

BEGIN;

-- The stuck set, named once: a reservation with live assignments, every folio closed, and no
-- recorded departure. `departure` is when the stay really ended — the last real check-out stamp.
CREATE TEMP TABLE stuck_stays ON COMMIT DROP AS
SELECT r.id AS reservation_id,
       max(a."checkedOutAt") AS departure
FROM "Reservation" r
JOIN "RoomAssignment" a ON a."reservationId" = r.id
WHERE r."departedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "RoomAssignment" x
              WHERE x."reservationId" = r.id AND x.status = 'active' AND x."checkedOutAt" IS NULL)
  AND EXISTS (SELECT 1 FROM "Folio" f WHERE f."reservationId" = r.id)
  AND NOT EXISTS (SELECT 1 FROM "Folio" f WHERE f."reservationId" = r.id AND f.status = 'open')
GROUP BY r.id
HAVING max(a."checkedOutAt") IS NOT NULL;  -- a stay that never checked out at all is a different problem

\echo 'Stays to repair:'
SELECT s.reservation_id, r."guestName", s.departure
FROM stuck_stays s JOIN "Reservation" r ON r.id = s.reservation_id;

-- 1. Record the departure that actually happened.
UPDATE "Reservation" r
SET "departedAt" = s.departure
FROM stuck_stays s
WHERE r.id = s.reservation_id;

-- 2. Close the assignments that should never have been opened, at the same moment. They keep their
--    rows so the mistake stays visible; they simply stop counting as occupancy.
UPDATE "RoomAssignment" a
SET "checkedOutAt" = s.departure,
    note = concat_ws(' · ', a.note, 'closed by repair-stuck-stays: assigned after the stay had departed')
FROM stuck_stays s
WHERE a."reservationId" = s.reservation_id
  AND a.status = 'active'
  AND a."checkedOutAt" IS NULL;

-- 3. The rooms those assignments held are free again, and nobody has cleaned them since. Dirty is
--    the honest state: it asks housekeeping to look, rather than asserting a room is ready.
UPDATE "Unit" u
SET "hkStatus" = 'dirty'
FROM "RoomAssignment" a
JOIN stuck_stays s ON s.reservation_id = a."reservationId"
WHERE u.id = a."unitId"
  AND a."checkedOutAt" = s.departure
  AND u."hkStatus" NOT IN ('out_of_order', 'dirty');

-- 4. A closed folio must say how it ended. These closed before the column existed, so they say
--    nothing; `outstanding` when money is still owed, `settled` when it is not — computed from the
--    lines rather than assumed, and left for a manager to resolve either way.
UPDATE "Folio" f
SET outcome = CASE
      WHEN COALESCE((
        SELECT sum(CASE WHEN l.kind = 'payment' THEN -l."amountMinor" ELSE l."amountMinor" END)
        FROM "FolioLine" l WHERE l."folioId" = f.id AND l.voided = false
      ), 0) = 0 THEN 'settled' ELSE 'outstanding' END
FROM stuck_stays s
WHERE f."reservationId" = s.reservation_id
  AND f.status = 'closed'
  AND f.outcome IS NULL;

\echo 'After repair:'
SELECT r."guestName", r."departedAt",
       (SELECT count(*) FROM "RoomAssignment" a
        WHERE a."reservationId" = r.id AND a.status = 'active' AND a."checkedOutAt" IS NULL) AS still_live,
       (SELECT string_agg(DISTINCT f.outcome, ', ') FROM "Folio" f WHERE f."reservationId" = r.id) AS outcomes
FROM "Reservation" r JOIN stuck_stays s ON s.reservation_id = r.id;

COMMIT;
