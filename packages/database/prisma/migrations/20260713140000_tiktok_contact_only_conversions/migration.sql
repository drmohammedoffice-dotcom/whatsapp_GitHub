-- Contact-only conversions: status, retry, first-message tracking.
ALTER TABLE "tiktok_integrations"
  ALTER COLUMN "default_optimization_event" SET DEFAULT 'Contact';

ALTER TABLE "tiktok_integration_conversions"
  ADD COLUMN IF NOT EXISTS "external_id" TEXT,
  ADD COLUMN IF NOT EXISTS "page_url" TEXT,
  ADD COLUMN IF NOT EXISTS "first_message_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contact_sent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tiktok_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "tiktok_response" JSONB,
  ADD COLUMN IF NOT EXISTS "tiktok_error" TEXT,
  ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP(3);

-- Backfill first_message_at / contact_sent from legacy sent rows.
UPDATE "tiktok_integration_conversions"
SET
  "first_message_at" = COALESCE("first_message_at", "sent_at", "created_at"),
  "contact_sent" = CASE WHEN "sent_at" IS NOT NULL THEN true ELSE "contact_sent" END,
  "tiktok_status" = CASE
    WHEN "sent_at" IS NOT NULL THEN 'sent'
    ELSE COALESCE(NULLIF("tiktok_status", ''), 'pending')
  END
WHERE "first_message_at" IS NULL OR "sent_at" IS NOT NULL;

ALTER TABLE "tiktok_integration_conversions"
  ALTER COLUMN "first_message_at" SET NOT NULL;

-- Allow pending retries before TikTok accepts the event.
ALTER TABLE "tiktok_integration_conversions"
  ALTER COLUMN "sent_at" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "tiktok_integration_conversions_tiktok_status_next_retry_at_idx"
  ON "tiktok_integration_conversions"("tiktok_status", "next_retry_at");
