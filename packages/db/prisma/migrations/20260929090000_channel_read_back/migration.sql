-- The nightly read-back: what each channel is actually publishing, compared with what we send.
ALTER TABLE "Channel" ADD COLUMN "readBackAt" TIMESTAMP(3);
ALTER TABLE "Channel" ADD COLUMN "readBackStatus" TEXT;
ALTER TABLE "Channel" ADD COLUMN "readBackFaults" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Channel" ADD COLUMN "readBackSummary" TEXT;
