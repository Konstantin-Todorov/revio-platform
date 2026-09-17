-- What the nightly mapping audit last learned about this channel's property, stored so the Operator
-- console reads a fact rather than an Error Center entry the hotel can mark resolved.
-- `catalogueStatus`: ok | property_missing | unreadable. Null = never asked.
ALTER TABLE "Channel" ADD COLUMN "catalogueCheckedAt" TIMESTAMP(3);
ALTER TABLE "Channel" ADD COLUMN "catalogueStatus" TEXT;
