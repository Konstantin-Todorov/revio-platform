-- Recognise the mailbox, not the string.
--
-- `maria+trial2@gmail.com`, `maria+trial3@gmail.com` and `m.a.r.i.a@gmail.com` all arrive in the
-- same inbox as `maria@gmail.com`. Compared as strings they are four people, and with public signup
-- live each of them gets thirty free days of all three products. Sub-addressing is the commonest way
-- a trial is taken twice and it requires no skill whatsoever.
--
-- ⚠️ `emailKey` is for RECOGNITION ONLY. Nobody signs in with it and no mail is ever sent to it —
-- normalising the address people actually use would lock somebody out of their own account the day
-- their provider started caring about dots. `email` stays exactly as it is.
--
-- ⚠️ NOT unique, deliberately. Two staff at one hotel may share a mailbox through sub-addressing,
-- and a unique index would refuse the second one just as a manager was adding them. The question
-- this answers is "has this mailbox already had a free trial", which is asked once at signup.
ALTER TABLE "User" ADD COLUMN "emailKey" TEXT;

-- `User` is under FORCE ROW LEVEL SECURITY, which binds the table owner too — only a superuser is
-- exempt. No migration in this repo had ever set the policy's escape hatch, so an unqualified UPDATE
-- here would match zero rows and report success. Transaction-local, and harmless where unneeded.
SELECT set_config('app.bypass', 'on', true);

-- Backfill with the same rule `emailIdentityKey` applies in code: lower-case, drop any `+suffix`,
-- and drop dots ONLY for Gmail, where they are not part of the mailbox. Everywhere else a dot is
-- part of the name and merging on it would hand one hotelier another one's account.
UPDATE "User"
SET "emailKey" = CASE
      WHEN split_part(lower("email"), '@', 2) IN ('gmail.com', 'googlemail.com')
        THEN replace(split_part(split_part(lower("email"), '@', 1), '+', 1), '.', '')
             || '@' || split_part(lower("email"), '@', 2)
      ELSE split_part(split_part(lower("email"), '@', 1), '+', 1)
             || '@' || split_part(lower("email"), '@', 2)
    END
WHERE "email" LIKE '%@%';

CREATE INDEX "User_emailKey_idx" ON "User"("emailKey");
