-- TikTok Login Kit: per-user OAuth accounts

CREATE TABLE "tiktok_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "open_id" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tiktok_accounts_user_id_key" ON "tiktok_accounts"("user_id");
CREATE UNIQUE INDEX "tiktok_accounts_open_id_key" ON "tiktok_accounts"("open_id");
CREATE INDEX "tiktok_accounts_open_id_idx" ON "tiktok_accounts"("open_id");

ALTER TABLE "tiktok_accounts" ADD CONSTRAINT "tiktok_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
