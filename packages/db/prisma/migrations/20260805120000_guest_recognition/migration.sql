-- Returning-guest recognition (K6) needs exactly one new fact: has this guest asked us not to?
--
-- Everything else recognition needs is already in the database — the shared Guest record, its
-- reservations, its notes. That is the platform's structural claim doing real work: a booking engine
-- bolted onto a foreign PMS would need to import stay history before it could greet anybody.
--
-- Deliberately NOT an erasure flag. "Do not greet me by name" and "delete my data" are different
-- requests with different legal answers: a hotel must retain booking and invoice records regardless
-- of preference. This suppresses recognition and carried-over preferences; it does not touch history.
ALTER TABLE "Guest" ADD COLUMN "recognitionOptOut" BOOLEAN NOT NULL DEFAULT false;
