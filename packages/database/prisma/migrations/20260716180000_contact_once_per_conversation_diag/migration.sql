-- Restore one Contact per conversation (Ads / Events Manager semantics).
-- Keep message_id unique for webhook-retry idempotency when present.
-- First remove duplicates left by the earlier per-message Contact experiment.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY integration_id, event_name, conversation_id
      ORDER BY
        CASE WHEN contact_sent THEN 0 ELSE 1 END,
        CASE WHEN tiktok_status = 'sent' THEN 0 ELSE 1 END,
        sent_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM "tiktok_integration_conversions"
  WHERE "conversation_id" IS NOT NULL
)
DELETE FROM "tiktok_integration_conversions"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_event_name_conversation_id_key"
  ON "tiktok_integration_conversions"("integration_id", "event_name", "conversation_id");

CREATE TABLE IF NOT EXISTS "tiktok_integration_inbound_diags" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "integration_id" TEXT,
  "channel_id" TEXT,
  "conversation_id" TEXT,
  "message_id" TEXT,
  "whatsapp_phone" TEXT,
  "business_phone" TEXT,
  "pixel_code" TEXT,
  "ttclid" TEXT,
  "is_new_conversation" BOOLEAN,
  "outcome" TEXT NOT NULL,
  "reason" TEXT,
  "tiktok_status" TEXT,
  "tiktok_response" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tiktok_integration_inbound_diags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tiktok_integration_inbound_diags_team_id_created_at_idx"
  ON "tiktok_integration_inbound_diags"("team_id", "created_at");

CREATE INDEX IF NOT EXISTS "tiktok_integration_inbound_diags_integration_id_created_at_idx"
  ON "tiktok_integration_inbound_diags"("integration_id", "created_at");
