-- A card guarantee taken at booking time (RevioDirect). Token only — no card number is ever stored
-- anywhere in this database; PCI scope stays with the gateway. brand/last4 are for human
-- recognition at the desk and to raise a no-show charge against the right instrument.
ALTER TABLE "Reservation"
  ADD COLUMN "guaranteeRef"   TEXT,
  ADD COLUMN "guaranteeBrand" TEXT,
  ADD COLUMN "guaranteeLast4" TEXT;
