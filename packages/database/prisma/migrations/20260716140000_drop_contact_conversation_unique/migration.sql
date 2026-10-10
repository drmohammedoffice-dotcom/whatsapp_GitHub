-- Remove leftover single-column uniques that block Contact-per-message.
-- Older migrations created UNIQUE INDEX (not CONSTRAINT), so DROP CONSTRAINT was a no-op.

DROP INDEX IF EXISTS "tiktok_integration_conversions_conversation_id_key";
DROP INDEX IF EXISTS "tiktok_integration_conversions_lead_id_key";
DROP INDEX IF EXISTS "tiktok_integration_conversions_integration_id_event_name_conversation_id_key";

-- Ensure per-message uniqueness exists (idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_event_name_message_id_key"
  ON "tiktok_integration_conversions"("integration_id", "event_name", "message_id");
