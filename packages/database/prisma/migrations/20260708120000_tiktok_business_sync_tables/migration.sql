-- Rename marketing advertisers table to tiktok_advertisers
ALTER TABLE "tiktok_marketing_advertisers" RENAME TO "tiktok_advertisers";

-- Add team_id to advertisers
ALTER TABLE "tiktok_advertisers" ADD COLUMN IF NOT EXISTS "team_id" TEXT;
CREATE INDEX IF NOT EXISTS "tiktok_advertisers_team_id_idx" ON "tiktok_advertisers"("team_id");

-- TikTok Marketing API synced campaigns
CREATE TABLE "tiktok_campaigns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "advertiser_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT,
    "budget" DOUBLE PRECISION,
    "objective" TEXT,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tiktok_campaigns_user_id_advertiser_id_campaign_id_key"
  ON "tiktok_campaigns"("user_id", "advertiser_id", "campaign_id");
CREATE INDEX "tiktok_campaigns_user_id_idx" ON "tiktok_campaigns"("user_id");
CREATE INDEX "tiktok_campaigns_team_id_idx" ON "tiktok_campaigns"("team_id");

ALTER TABLE "tiktok_campaigns" ADD CONSTRAINT "tiktok_campaigns_user_id_advertiser_id_fkey"
  FOREIGN KEY ("user_id", "advertiser_id") REFERENCES "tiktok_advertisers"("user_id", "advertiser_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- TikTok Marketing API synced ad groups
CREATE TABLE "tiktok_adgroups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "advertiser_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "adgroup_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT,
    "billing_event" TEXT,
    "budget" DOUBLE PRECISION,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_adgroups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tiktok_adgroups_user_id_advertiser_id_adgroup_id_key"
  ON "tiktok_adgroups"("user_id", "advertiser_id", "adgroup_id");
CREATE INDEX "tiktok_adgroups_user_id_idx" ON "tiktok_adgroups"("user_id");
CREATE INDEX "tiktok_adgroups_team_id_idx" ON "tiktok_adgroups"("team_id");
CREATE INDEX "tiktok_adgroups_campaign_id_idx" ON "tiktok_adgroups"("campaign_id");

ALTER TABLE "tiktok_adgroups" ADD CONSTRAINT "tiktok_adgroups_user_id_advertiser_id_fkey"
  FOREIGN KEY ("user_id", "advertiser_id") REFERENCES "tiktok_advertisers"("user_id", "advertiser_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tiktok_adgroups" ADD CONSTRAINT "tiktok_adgroups_user_id_advertiser_id_campaign_id_fkey"
  FOREIGN KEY ("user_id", "advertiser_id", "campaign_id") REFERENCES "tiktok_campaigns"("user_id", "advertiser_id", "campaign_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- TikTok Marketing API synced ads
CREATE TABLE "tiktok_ads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "advertiser_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "adgroup_id" TEXT,
    "ad_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_ads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tiktok_ads_user_id_advertiser_id_ad_id_key"
  ON "tiktok_ads"("user_id", "advertiser_id", "ad_id");
CREATE INDEX "tiktok_ads_user_id_idx" ON "tiktok_ads"("user_id");
CREATE INDEX "tiktok_ads_team_id_idx" ON "tiktok_ads"("team_id");
CREATE INDEX "tiktok_ads_adgroup_id_idx" ON "tiktok_ads"("adgroup_id");

ALTER TABLE "tiktok_ads" ADD CONSTRAINT "tiktok_ads_user_id_advertiser_id_fkey"
  FOREIGN KEY ("user_id", "advertiser_id") REFERENCES "tiktok_advertisers"("user_id", "advertiser_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tiktok_ads" ADD CONSTRAINT "tiktok_ads_user_id_advertiser_id_adgroup_id_fkey"
  FOREIGN KEY ("user_id", "advertiser_id", "adgroup_id") REFERENCES "tiktok_adgroups"("user_id", "advertiser_id", "adgroup_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
