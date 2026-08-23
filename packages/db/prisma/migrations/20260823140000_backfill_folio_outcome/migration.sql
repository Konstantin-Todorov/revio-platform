-- Give every already-closed folio an outcome.
--
-- `Folio.outcome` was added so that "closed" is never ambiguous about money. Folios closed before it
-- existed say nothing, and production holds twelve of them — each one a bill a hotelier can open and
-- not be told whether it was settled, forgiven or is still owed.
--
-- Unlike `departedAt`, this is NOT a guess. For a closed folio the answer is arithmetic on rows that
-- are already there: charges minus payments. Zero means it was settled; anything else means the
-- money is still owed and the folio belongs in receivables. The two states it deliberately does not
-- infer are `paid_offsystem` and `written_off` — those record a human decision and a reason, and
-- inventing one would be writing fiction into an accounting record. A non-zero balance becomes
-- `outstanding`, which is the honest "still owed, nobody has decided yet", and the folio screen
-- offers the four ways to resolve it.
--
-- Idempotent: only rows where outcome IS NULL are touched.

UPDATE "Folio" f
SET outcome = CASE
      WHEN COALESCE((
        SELECT sum(CASE WHEN l.kind = 'payment' THEN -l."amountMinor" ELSE l."amountMinor" END)
        FROM "FolioLine" l
        WHERE l."folioId" = f.id AND l.voided = false
      ), 0) = 0 THEN 'settled'
      ELSE 'outstanding'
    END
WHERE f.status = 'closed' AND f.outcome IS NULL;
