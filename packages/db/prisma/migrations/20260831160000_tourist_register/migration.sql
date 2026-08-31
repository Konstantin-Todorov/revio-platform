-- Регистър на настанените туристи — the register of accommodated tourists.
--
-- Content fixed by Заповед № Т-РД-14-10 / 11.06.2019, issued under чл. 116 ал. 1 от Закона за
-- туризма. Keeping it has been compulsory for EVERY accommodation provider since 1 October 2019,
-- and class A names вили explicitly — a villa is in scope exactly as a hotel is.
--
-- Read from the order itself rather than from a summary. The last Bulgarian requirement encoded
-- here from memory was wrong for a month (see docs/specs/BG-FISCALIZATION-RESEARCH.md), so the
-- source is cited on every field that has one.
--
-- This is NOT fiscalization. A guest register records who slept where; it reports no sale to НАП and
-- does not make this software СУПТО. The two obligations are unrelated and stay apart.
CREATE TABLE "StayGuest" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "propertyId"      TEXT NOT NULL,
  "reservationId"   TEXT NOT NULL,
  "guestId"         TEXT,

  -- Пореден номер от регистъра. Gap-free per property; see `claimRegisterNo`.
  "registerNo"      INTEGER NOT NULL,
  -- Дата на регистрация.
  "registeredAt"    TIMESTAMP(3) NOT NULL,

  -- Пълното име на лицето.
  "fullName"        TEXT NOT NULL,
  -- ЕГН/ЛЧН/персонален идентификационен номер.
  "personalId"      TEXT,
  -- Дата на раждане.
  "dateOfBirth"     DATE,
  -- Пол.
  "sex"             TEXT,
  -- Гражданство (ISO 3166-1 alpha-2).
  "nationality"     TEXT,
  -- Номер на документ за самоличност.
  "documentNumber"  TEXT,
  -- Серия на документа — т. 1.2 (non-EEA/CH) asks for the series as well as the number.
  "documentSeries"  TEXT,
  -- Държава, издала националния документ.
  "documentCountry" TEXT,

  -- Етаж, стая/апартамент. A SNAPSHOT taken at check-in, not a join to the current assignment: a
  -- room move next season must not rewrite where somebody slept two years ago.
  "unitLabel"       TEXT,
  "floor"           TEXT,

  -- Ползване на туристически пакет (да/не).
  "touristPackage"  BOOLEAN NOT NULL DEFAULT false,

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StayGuest_pkey" PRIMARY KEY ("id")
);

-- The register number is the register's own identity. Unique per property and never reused, which
-- is also what makes the claim safe to retry.
CREATE UNIQUE INDEX "StayGuest_propertyId_registerNo_key" ON "StayGuest"("propertyId", "registerNo");
CREATE INDEX "StayGuest_reservationId_idx" ON "StayGuest"("reservationId");
CREATE INDEX "StayGuest_propertyId_registeredAt_idx" ON "StayGuest"("propertyId", "registeredAt");
CREATE INDEX "StayGuest_guestId_idx" ON "StayGuest"("guestId");

ALTER TABLE "StayGuest" ADD CONSTRAINT "StayGuest_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StayGuest" ADD CONSTRAINT "StayGuest_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL, not CASCADE: a guest profile merged away or erased must not take the register entry
-- with it. т. 3 of the order requires the register to be kept a minimum of two years, and that
-- obligation outlives a guest's erasure request (GDPR Art. 17(3)(b)).
ALTER TABLE "StayGuest" ADD CONSTRAINT "StayGuest_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Identity documents of a hotel's guests: among the most sensitive rows in the database, and the
-- reason this table gets the same enforcement as everything else rather than a convention.
ALTER TABLE "StayGuest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StayGuest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StayGuest"
  USING (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass', true) = 'on'
    OR "tenantId" = current_setting('app.tenant_id', true)
  );
