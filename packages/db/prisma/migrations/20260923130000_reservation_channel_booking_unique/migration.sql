-- One reservation per (channel, external booking id). Production held no duplicates when this was
-- added (checked 2026-09-23), so the index builds without a cleanup step.
CREATE UNIQUE INDEX "Reservation_channelId_externalId_key" ON "Reservation"("channelId", "externalId");
