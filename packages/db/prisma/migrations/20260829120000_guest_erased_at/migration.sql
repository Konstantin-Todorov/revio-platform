-- GDPR Art. 17. Erasure anonymises the guest in place rather than deleting the row: reservations
-- keep their link (occupancy and revenue history stay correct) and tax invoices stay reconcilable to
-- the stay they were issued for, which Art. 17(3)(b) requires us to retain.
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "erasedAt" TIMESTAMP(3);
