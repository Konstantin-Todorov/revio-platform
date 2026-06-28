-- Per-channel adapter mode: demo channels stay 'mock'; channex_* talks to the real Channex API.
ALTER TABLE "Channel" ADD COLUMN "connectivityMode" TEXT NOT NULL DEFAULT 'mock';
