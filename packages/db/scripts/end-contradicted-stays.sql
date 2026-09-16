-- End stays that the database itself says cannot be happening.
--
-- Companion to `repair-stuck-stays.sql`, which fixes a different fault (checked out, then checked in
-- again). This one covers two states the audit found in production that nothing else repairs.
--
-- ⚠️ IT IS DELIBERATELY NARROW. "Overstayed" on its own is NOT repaired here and must not be: a
-- guest past their departure date is usually a real person still in the room, and ending their stay
-- from a script would release an occupied room and stop their charges accruing. The front desk owns
-- that. Only the two cases below are unambiguous.
--
--   1. CANCELLED AND IN HOUSE. The reservation says it never happened; the room says somebody is in
--      it. One of them is wrong and it is not the cancellation — the booking is gone. Production
--      carried one from 29 July, cancelled while checked in, because RevioLink's cancel action had
--      no in-house guard (fixed in code; this repairs the row it left).
--
--   2. TEST BOOKINGS ON A REAL CLIENT. Two stays literally named "Channel Manager Test" were
--      checked into rooms 108 and 110 on DesManagement 2015 during certification and never checked
--      out. They are not guests. They hold two real rooms out of service and distort that client's
--      occupancy. Matched by name AND by a non-demo tenant, so it can never catch a real guest whose
--      name happens to contain those words in a demo hotel.
--
-- WHAT IT DOES NOT DO, deliberately:
--   * No money line is touched. Charges that accrued are real rows, and whether they are owed,
--     waived or written off is a manager's decision with a reason — §1.4 gives four ways to record
--     it. A script that quietly edits somebody's bill is worse than the fault it repairs.
--   * No row is deleted. The assignments are stamped checked-out so the history still shows they
--     existed.
--   * `checkedOutAt` is the stay's SCHEDULED departure, not now. Stamping today would claim the
--     guest left today, which is a new false fact in place of the old one.
--
-- Idempotent: after one run nothing matches.
--
--   psql "$DATABASE_PUBLIC_URL" -f packages/db/scripts/end-contradicted-stays.sql

BEGIN;

CREATE TEMP TABLE contradicted ON COMMIT DROP AS
SELECT a.id AS assignment_id,
       a."reservationId" AS reservation_id,
       a."checkOut"      AS scheduled_out,
       t.name            AS tenant,
       r."guestName"     AS guest,
       u.label           AS room,
       CASE WHEN r.status = 'cancelled' THEN 'cancelled while in house'
            ELSE 'certification test booking on a live client' END AS reason
FROM "RoomAssignment" a
JOIN "Reservation" r ON r.id = a."reservationId"
JOIN "Tenant" t      ON t.id = a."tenantId"
JOIN "Unit" u        ON u.id = a."unitId"
WHERE a.status = 'active'
  AND a."checkedOutAt" IS NULL
  AND a."checkedInAt" IS NOT NULL
  AND (
        r.status = 'cancelled'
     OR (t."isDemo" = false AND r."guestName" LIKE 'Channel Manager Test%')
      );

\echo ''
\echo '=== Stays about to be ended ================================================='
SELECT tenant, guest, room, scheduled_out::date AS ended_as_of, reason FROM contradicted ORDER BY tenant, guest;
\echo ''

-- Close the assignment as of the night the stay was always going to end.
UPDATE "RoomAssignment" a
SET "checkedOutAt" = c.scheduled_out, status = 'active'
FROM contradicted c
WHERE a.id = c.assignment_id;

-- `departedAt` is what the platform treats as authoritative for "the stay is over" — it is
-- deliberately NOT a status value, because a departed guest's booking is still sold and still earns.
UPDATE "Reservation" r
SET "departedAt" = c.scheduled_out
FROM (SELECT reservation_id, max(scheduled_out) AS scheduled_out FROM contradicted GROUP BY reservation_id) c
WHERE r.id = c.reservation_id
  AND r."departedAt" IS NULL;

\echo '=== Rooms now free ========================================================='
SELECT count(*) AS assignments_closed FROM contradicted;
\echo ''

COMMIT;
