-- The guest's key to manage a RevioDirect booking (cancel, change dates) from the email link.
ALTER TABLE "Reservation" ADD COLUMN "guestManageToken" TEXT;
CREATE UNIQUE INDEX "Reservation_guestManageToken_key" ON "Reservation"("guestManageToken");
