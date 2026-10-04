-- Rooms booked together on RevioDirect: each its own reservation, grouped for the guest and the desk.
ALTER TABLE "Reservation" ADD COLUMN "bookingGroupId" TEXT;
CREATE INDEX "Reservation_bookingGroupId_idx" ON "Reservation"("bookingGroupId");
