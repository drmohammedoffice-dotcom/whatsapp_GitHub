-- Isolate Inbox WhatsApp from TikTok Pixel tracking WhatsApp.

DO $$ BEGIN
  CREATE TYPE "ChannelPurpose" AS ENUM ('INBOX', 'TRACKING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "purpose" "ChannelPurpose" NOT NULL DEFAULT 'INBOX';
ALTER TABLE "WhatsAppSession" ADD COLUMN IF NOT EXISTS "purpose" "ChannelPurpose" NOT NULL DEFAULT 'INBOX';

-- Backfill TRACKING from legacy metadata JSON.
UPDATE "Channel"
SET "purpose" = 'TRACKING'
WHERE COALESCE(metadata->>'purpose', '') = 'tracking'
   OR COALESCE(metadata->>'connectionSource', '') = 'tiktok_tracking';

UPDATE "WhatsAppSession" AS s
SET "purpose" = 'TRACKING'
FROM "Channel" AS c
WHERE c."whatsAppSessionId" = s."id"
  AND c."purpose" = 'TRACKING';

-- Allow the same phone on Inbox + Tracking as two independent sessions.
ALTER TABLE "WhatsAppSession" DROP CONSTRAINT IF EXISTS "WhatsAppSession_teamId_phoneNumber_key";

DROP INDEX IF EXISTS "WhatsAppSession_teamId_phoneNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppSession_teamId_phoneNumber_purpose_key"
  ON "WhatsAppSession"("teamId", "phoneNumber", "purpose");

CREATE INDEX IF NOT EXISTS "Channel_teamId_purpose_idx" ON "Channel"("teamId", "purpose");
CREATE INDEX IF NOT EXISTS "Channel_teamId_provider_purpose_idx" ON "Channel"("teamId", "provider", "purpose");
CREATE INDEX IF NOT EXISTS "WhatsAppSession_teamId_purpose_idx" ON "WhatsAppSession"("teamId", "purpose");

-- Hide any previously leaked tracking conversations from the Inbox UI.
UPDATE "Conversation" AS conv
SET "isArchived" = true
FROM "Channel" AS ch
WHERE conv."channelId" = ch."id"
  AND ch."purpose" = 'TRACKING';
