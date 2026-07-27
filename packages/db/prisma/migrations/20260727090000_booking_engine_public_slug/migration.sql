-- Booking engine: a property's public address and its on/off switch.
--
-- publicSlug resolves book.revio.app/<slug> to one property with NO tenant context available (the
-- request is unauthenticated), which is why it is globally unique rather than unique per tenant.
ALTER TABLE "Property" ADD COLUMN "publicSlug" TEXT;
ALTER TABLE "Property" ADD COLUMN "bookingEngineEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Property_publicSlug_key" ON "Property"("publicSlug");
