-- TikTok Login Kit: Business Center + advertiser sync (user-scoped)

ALTER TABLE "tiktok_accounts" ADD COLUMN "team_id" TEXT;
ALTER TABLE "tiktok_accounts" ADD COLUMN "has_business_access" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tiktok_accounts" ADD COLUMN "business_center_id" TEXT;
ALTER TABLE "tiktok_accounts" ADD COLUMN "business_center_name" TEXT;
ALTER TABLE "tiktok_accounts" ADD COLUMN "last_business_sync_at" TIMESTAMP(3);
ALTER TABLE "tiktok_accounts" ADD COLUMN "business_sync_message" TEXT;

CREATE INDEX "tiktok_accounts_team_id_idx" ON "tiktok_accounts"("team_id");

CREATE TABLE "tiktok_login_advertisers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_login_advertisers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tiktok_login_advertisers_user_id_advertiser_id_key" ON "tiktok_login_advertisers"("user_id", "advertiser_id");
CREATE INDEX "tiktok_login_advertisers_user_id_idx" ON "tiktok_login_advertisers"("user_id");

ALTER TABLE "tiktok_login_advertisers" ADD CONSTRAINT "tiktok_login_advertisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tiktok_accounts"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
