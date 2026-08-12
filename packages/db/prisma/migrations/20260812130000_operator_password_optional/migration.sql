-- Operator accounts are created by invitation, so they start with no password (N2).
--
-- Previously `createOperatorUser` set the same hardcoded value every hotel account also used. The
-- console that can see every tenant on the platform was therefore reachable with a password printed
-- on its own sign-in page. Now the account exists but cannot be signed into until the person named
-- on it chooses a password from an emailed, single-use link.
--
-- Nullable rather than a sentinel string: "no password" is a real state that the login check must
-- see, and a magic value like '' or 'PENDING' is one missed comparison away from being a password.
ALTER TABLE "OperatorUser" ALTER COLUMN "passwordHash" DROP NOT NULL;
