-- Contact on every inbound WhatsApp message (unique per message, not per conversation).
ALTER TABLE "tiktok_integration_conversions"
  ADD COLUMN IF NOT EXISTS "message_id" TEXT;

DROP INDEX IF EXISTS "tiktok_integration_conversions_integration_id_event_name_conversation_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_event_name_message_id_key"
  ON "tiktok_integration_conversions"("integration_id", "event_name", "message_id");

CREATE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_conversation_id_created_at_idx"
  ON "tiktok_integration_conversions"("integration_id", "conversation_id", "created_at");
