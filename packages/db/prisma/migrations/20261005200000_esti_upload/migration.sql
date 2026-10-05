-- ЕСТИ upload: the property's НТР number, and what ЕСТИ last received per registration. Additive only.
ALTER TABLE "PropertyDefaults" ADD COLUMN "estiPlaceUin" TEXT;
ALTER TABLE "StayGuest" ADD COLUMN "estiFingerprint" TEXT;
ALTER TABLE "StayGuest" ADD COLUMN "estiSentAt" TIMESTAMP(3);
