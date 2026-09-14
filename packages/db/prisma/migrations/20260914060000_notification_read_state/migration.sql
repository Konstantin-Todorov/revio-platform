-- Notification read state, per person.
--
-- The attention bell every product already has counts what is wrong AT THE HOTEL, so it reads the
-- same for everyone who signs in. A notification centre answers a different question — what has
-- happened, and whether THIS person has seen it — and that needs somewhere per-user to remember it.
--
-- `notificationsClearedAt` is "mark all as read": one timestamp, so clearing a thousand items is a
-- single write. `notificationsReadKeys` holds the individual ones read since; the action that
-- writes it caps the list and empties it whenever the marker moves, so it cannot grow without bound.
--
-- Additive and backfill-free in both directions: every existing row reads as "has never opened the
-- panel", which is exactly true, and the first render simply shows everything as unread.
ALTER TABLE "User" ADD COLUMN "notificationsClearedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "notificationsReadKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "OperatorUser" ADD COLUMN "notificationsClearedAt" TIMESTAMP(3);
ALTER TABLE "OperatorUser" ADD COLUMN "notificationsReadKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
