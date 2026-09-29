-- The footer sentence is part of the issued document, so it is frozen with it.
ALTER TABLE "Invoice" ADD COLUMN "footerNote" TEXT;
