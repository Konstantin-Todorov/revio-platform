-- The Channex webhook id for this property, so a booking arrives in seconds rather than on the
-- five-minute poll. Per property, because that is how Channex keys a webhook.
ALTER TABLE "Property" ADD COLUMN "channexWebhookId" TEXT;
