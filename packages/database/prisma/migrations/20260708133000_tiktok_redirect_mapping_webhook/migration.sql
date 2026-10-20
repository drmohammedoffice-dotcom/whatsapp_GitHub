-- Ensure click table uses requested name
DO $$
BEGIN
  IF to_regclass('"TikTokTrackingClick"') IS NOT NULL AND to_regclass('tiktok_clicks') IS NULL THEN
    EXECUTE 'ALTER TABLE "TikTokTrackingClick" RENAME TO tiktok_clicks';
  END IF;
END $$;

ALTER TABLE IF EXISTS "tiktok_clicks"
  ADD COLUMN IF NOT EXISTS "advertiserId" TEXT,
  ADD COLUMN IF NOT EXISTS "campaign_id" TEXT,
  ADD COLUMN IF NOT EXISTS "adgroup_id" TEXT,
  ADD COLUMN IF NOT EXISTS "ad_id" TEXT;

CREATE INDEX IF NOT EXISTS "tiktok_clicks_ttclid_idx" ON "tiktok_clicks"("ttclid");

-- WhatsApp mapping table for TikTok IDs -> WhatsApp number routing
CREATE TABLE IF NOT EXISTS "tiktok_whatsapp_mappings" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "campaign_local_id" TEXT,
  "advertiser_id" TEXT,
  "campaign_id" TEXT,
  "adgroup_id" TEXT,
  "ad_id" TEXT,
  "whatsapp_number" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tiktok_whatsapp_mappings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tiktok_whatsapp_mappings_teamId_is_active_idx"
  ON "tiktok_whatsapp_mappings"("teamId", "is_active");
CREATE INDEX IF NOT EXISTS "tiktok_whatsapp_mappings_lookup_idx"
  ON "tiktok_whatsapp_mappings"("teamId", "campaign_id", "adgroup_id", "ad_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tiktok_whatsapp_mappings_teamId_fkey'
  ) THEN
    ALTER TABLE "tiktok_whatsapp_mappings"
      ADD CONSTRAINT "tiktok_whatsapp_mappings_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tiktok_whatsapp_mappings_campaign_local_id_fkey'
  ) THEN
    ALTER TABLE "tiktok_whatsapp_mappings"
      ADD CONSTRAINT "tiktok_whatsapp_mappings_campaign_local_id_fkey"
      FOREIGN KEY ("campaign_local_id") REFERENCES "TikTokCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
