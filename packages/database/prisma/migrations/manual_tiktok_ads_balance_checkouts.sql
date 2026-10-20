-- Safe additive migration for TikTok Ads Balance external checkout sessions.
-- Does not drop or alter existing tables destructively.

DO $$ BEGIN
  CREATE TYPE "TikTokAdsBalanceCheckoutStatus" AS ENUM (
    'INITIATED',
    'REDIRECTED',
    'PENDING_CONFIRMATION',
    'EXTERNAL_CHECKOUT',
    'CONFIRMED',
    'FAILED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tiktok_ads_balance_checkouts" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "advertiser_id" TEXT NOT NULL,
  "advertiser_name" TEXT,
  "currency" TEXT,
  "status" "TikTokAdsBalanceCheckoutStatus" NOT NULL DEFAULT 'INITIATED',
  "destination_url" TEXT NOT NULL,
  "confirmation_source" TEXT,
  "balance_before" DOUBLE PRECISION,
  "balance_after" DOUBLE PRECISION,
  "last_checked_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tiktok_ads_balance_checkouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tiktok_ads_balance_checkouts_team_id_created_at_idx"
  ON "tiktok_ads_balance_checkouts"("team_id", "created_at");

CREATE INDEX IF NOT EXISTS "tiktok_ads_balance_checkouts_user_id_created_at_idx"
  ON "tiktok_ads_balance_checkouts"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "tiktok_ads_balance_checkouts_team_id_advertiser_id_idx"
  ON "tiktok_ads_balance_checkouts"("team_id", "advertiser_id");
