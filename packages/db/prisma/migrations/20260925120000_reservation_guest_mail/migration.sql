-- When the scheduled guest emails went out for a stay. Null for every existing reservation — and the
-- job only mails stays arriving or leaving from now on, so nothing old is ever sent.
ALTER TABLE "Reservation" ADD COLUMN "preArrivalMailedAt" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN "postStayMailedAt" TIMESTAMP(3);
