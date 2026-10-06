-- The hotel's own Google Analytics 4 / Meta pixel ids for its RevioDirect page. Additive, nullable:
-- null means no tag and no consent banner.
ALTER TABLE "Property" ADD COLUMN "bookingGa4Id" TEXT;
ALTER TABLE "Property" ADD COLUMN "bookingMetaPixelId" TEXT;
