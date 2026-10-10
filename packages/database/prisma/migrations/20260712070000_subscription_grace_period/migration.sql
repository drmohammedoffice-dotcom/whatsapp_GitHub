-- Add subscription grace-period tracking fields
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "expired_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "grace_purged_at" TIMESTAMP(3);
