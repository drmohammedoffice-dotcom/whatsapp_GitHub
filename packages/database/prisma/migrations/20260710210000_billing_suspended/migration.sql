-- Billing / admin platform models + TikTok billing suspension flag
ALTER TABLE "tiktok_integrations" ADD COLUMN IF NOT EXISTS "billing_suspended" BOOLEAN NOT NULL DEFAULT false;
