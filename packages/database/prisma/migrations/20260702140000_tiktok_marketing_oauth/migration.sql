-- TikTok Marketing API OAuth (separate from Login Kit)

CREATE TABLE "tiktok_marketing_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "marketing_access_token" TEXT NOT NULL,
    "marketing_refresh_token" TEXT,
    "marketing_expires_at" TIMESTAMP(3) NOT NULL,
    "marketing_refresh_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "has_business_access" BOOLEAN NOT NULL DEFAULT false,
    "business_center_id" TEXT,
    "business_center_name" TEXT,
    "last_business_sync_at" TIMESTAMP(3),
    "business_sync_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_marketing_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tiktok_marketing_connections_user_id_key" ON "tiktok_marketing_connections"("user_id");
CREATE INDEX "tiktok_marketing_connections_team_id_idx" ON "tiktok_marketing_connections"("team_id");

ALTER TABLE "tiktok_marketing_connections" ADD CONSTRAINT "tiktok_marketing_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tiktok_marketing_advertisers" (
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

    CONSTRAINT "tiktok_marketing_advertisers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tiktok_marketing_advertisers_user_id_advertiser_id_key" ON "tiktok_marketing_advertisers"("user_id", "advertiser_id");
CREATE INDEX "tiktok_marketing_advertisers_user_id_idx" ON "tiktok_marketing_advertisers"("user_id");

ALTER TABLE "tiktok_marketing_advertisers" ADD CONSTRAINT "tiktok_marketing_advertisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tiktok_marketing_connections"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
