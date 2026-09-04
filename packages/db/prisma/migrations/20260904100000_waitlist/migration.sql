-- The waitlist: demand a sold-out date currently throws away.
--
-- RevioDirect answers a sold-out search with real alternative stays, which is good, and then forgets
-- the guest. When a cancellation re-opens the room an hour later, nobody is told. This table is the
-- memory that makes the second half possible.
--
-- Who gets offered a freed room is decided in `@revio/core/waitlist` (26 tests) rather than here or
-- in the job: whole-stay-or-nothing, stop-sell respected, oldest first. See docs/specs/WAITLIST.md.

CREATE TABLE "WaitlistEntry" (
  "id"             TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "propertyId"     TEXT NOT NULL,

  -- NULL means "any room that sleeps my party" — the same unscoped-means-everything convention used
  -- by rate plans. A guest who does not care which room should not be held to one.
  "roomTypeId"     TEXT,

  -- DATE, not a timestamp. A stay is calendar dates resolved in the property's timezone; storing an
  -- instant would drift a day for exactly the hotels furthest from UTC.
  "checkIn"        DATE NOT NULL,
  "checkOut"       DATE NOT NULL,
  "guests"         INTEGER NOT NULL DEFAULT 2,

  "guestName"      TEXT NOT NULL,
  "guestEmail"     TEXT NOT NULL,
  "guestPhone"     TEXT,
  -- The language they searched in, so an offer does not arrive in the wrong one.
  "locale"         TEXT,

  -- waiting | offered | converted | expired | cancelled
  "status"         TEXT NOT NULL DEFAULT 'waiting',

  -- ⚠️ Queue position IS createdAt, ascending. There is deliberately no position column: a stored
  -- position must be renumbered on every insert, cancellation and conversion, and the first time
  -- that renumbering is wrong somebody is told they are second when they are fourth.
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "offeredAt"      TIMESTAMP(3),
  -- The real Hold backing the current offer. Not a foreign key on purpose: a hold is ephemeral and
  -- is released or expired by the hold job, and all we need is the id in order to release it.
  "offerHoldId"    TEXT,
  "offerExpiresAt" TIMESTAMP(3),
  -- Offers this entry has let lapse. Capped in core so we stop being a nuisance.
  "offerCount"     INTEGER NOT NULL DEFAULT 0,

  -- The stay that closed this entry. "Revenue recovered" is computed from this and nothing else.
  "reservationId"  TEXT,
  -- booking_engine | staff
  "source"         TEXT NOT NULL DEFAULT 'booking_engine',
  -- Single-use claim link carried by the offer email.
  "claimToken"     TEXT,

  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistEntry_claimToken_key" ON "WaitlistEntry"("claimToken");

-- The sweep asks "who is waiting at this property?" and "is anything waiting for these dates?".
CREATE INDEX "WaitlistEntry_propertyId_status_idx" ON "WaitlistEntry"("propertyId", "status");
CREATE INDEX "WaitlistEntry_propertyId_checkIn_idx" ON "WaitlistEntry"("propertyId", "checkIn");
CREATE INDEX "WaitlistEntry_roomTypeId_checkIn_idx" ON "WaitlistEntry"("roomTypeId", "checkIn");

ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL, not CASCADE: if the reservation that filled this entry is later deleted, the record that
-- somebody waited and was served must survive it — otherwise "rooms recovered" quietly falls.
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guest contact details for people who are not yet customers. Same enforcement as everything else.
ALTER TABLE "WaitlistEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaitlistEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WaitlistEntry"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );
