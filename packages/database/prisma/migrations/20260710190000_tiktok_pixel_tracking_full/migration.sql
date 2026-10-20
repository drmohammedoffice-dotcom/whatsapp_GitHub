ALTER TYPE "TikTokOptimizationEvent" ADD VALUE IF NOT EXISTS 'CompletePayment';

ALTER TABLE "tiktok_integrations"
  ADD COLUMN IF NOT EXISTS "pixel_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "pixel_status_message" TEXT,
  ADD COLUMN IF NOT EXISTS "last_pixel_status_check_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP(3);

ALTER TABLE "tiktok_marketing_connections"
  ADD COLUMN IF NOT EXISTS "tiktok_open_id" TEXT;
