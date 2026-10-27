-- Track WhatsApp conversation conversions (one event per real inbound conversation).
ALTER TABLE "tiktok_integration_leads"
  ADD COLUMN IF NOT EXISTS "conversation_id" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_id" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "converted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "conversion_event_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_leads_conversation_id_key"
  ON "tiktok_integration_leads"("conversation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_leads_conversion_event_id_key"
  ON "tiktok_integration_leads"("conversion_event_id");
CREATE INDEX IF NOT EXISTS "tiktok_integration_leads_integration_id_converted_at_idx"
  ON "tiktok_integration_leads"("integration_id", "converted_at");

CREATE TABLE IF NOT EXISTS "tiktok_integration_conversions" (
  "id" TEXT NOT NULL,
  "integration_id" TEXT NOT NULL,
  "lead_id" TEXT,
  "click_id" TEXT,
  "conversation_id" TEXT NOT NULL,
  "contact_id" TEXT,
  "whatsapp_phone" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "ttclid" TEXT,
  "sent_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tiktok_integration_conversions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_lead_id_key"
  ON "tiktok_integration_conversions"("lead_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_conversation_id_key"
  ON "tiktok_integration_conversions"("conversation_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_event_id_key"
  ON "tiktok_integration_conversions"("event_id");
CREATE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_whatsapp_phone_sent_at_idx"
  ON "tiktok_integration_conversions"("integration_id", "whatsapp_phone", "sent_at");

ALTER TABLE "tiktok_integration_conversions"
  ADD CONSTRAINT "tiktok_integration_conversions_integration_id_fkey"
  FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tiktok_integration_conversions"
  ADD CONSTRAINT "tiktok_integration_conversions_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "tiktok_integration_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
