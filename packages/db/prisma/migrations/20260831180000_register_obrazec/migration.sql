-- Align the register with the OFFICIAL образец, not only with the заповед's prose.
--
-- "Образец на регистър за настанените туристи", published by the Ministry of Tourism beside the
-- заповед, asks for five things the prose does not spell out:
--
--   * the name in THREE columns — Име / Бащино име / Фамилно име — and in a specific script:
--     "за български граждани - на кирилица, за чужденци - на латиница, съгласно националния документ"
--   * Тип на документ за самоличност, as its own column
--   * Час на регистрация / пристигане / отпътуване, alongside the dates
--   * Средна цена на нощувка (marked "незадължително за попълване")
--   * Анулирана регистрация — which is the answer to what to do with a registration made in error:
--     it is cancelled in place, never deleted. A register whose numbering has holes cannot be shown
--     to have had none.
--
-- The times and the price are derived at export from the stay and its folio, so only the name split,
-- the document type and the cancellation flag are columns.
ALTER TABLE "StayGuest" ADD COLUMN "firstName"    TEXT;
ALTER TABLE "StayGuest" ADD COLUMN "middleName"   TEXT;
ALTER TABLE "StayGuest" ADD COLUMN "lastName"     TEXT;
ALTER TABLE "StayGuest" ADD COLUMN "documentType" TEXT;
ALTER TABLE "StayGuest" ADD COLUMN "cancelled"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StayGuest" ADD COLUMN "cancelledNote" TEXT;

-- Split whatever single names exist. First token is the given name, last is the family name, and
-- anything between is the patronymic — which is how a Bulgarian three-part name reads, and the only
-- defensible guess for the rest. Production holds no rows at the time of writing, so in practice
-- this backfills development data only.
UPDATE "StayGuest"
SET "firstName"  = NULLIF(split_part(btrim("fullName"), ' ', 1), ''),
    "lastName"   = NULLIF(
      CASE WHEN btrim("fullName") LIKE '% %'
           THEN reverse(split_part(reverse(btrim("fullName")), ' ', 1))
           ELSE '' END, ''),
    "middleName" = NULLIF(btrim(
      regexp_replace(
        regexp_replace(btrim("fullName"), '^\S+\s*', ''),
        '\s*\S+$', ''
      )), '')
WHERE "fullName" IS NOT NULL AND btrim("fullName") <> '';

-- `firstName`/`lastName` stay NULLABLE on purpose. An entry opens blank at check-in and is completed
-- afterwards; a NOT NULL here would force an empty string to mean "not captured", which is the kind
-- of sentinel that later reads as a real value.
ALTER TABLE "StayGuest" DROP COLUMN "fullName";
