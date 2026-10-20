-- TikTok Events API credentials + multi-event conversions + API logs

ALTER TABLE "tiktok_integrations"
  ADD COLUMN IF NOT EXISTS "encrypted_events_api_access_token" TEXT,
  ADD COLUMN IF NOT EXISTS "events_api_token_hint" TEXT,
  ADD COLUMN IF NOT EXISTS "events_api_connected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "events_api_status" TEXT NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS "events_api_status_message" TEXT,
  ADD COLUMN IF NOT EXISTS "last_events_api_verification_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_event_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_event_name" TEXT,
  ADD COLUMN IF NOT EXISTS "last_api_http_status" INTEGER,
  ADD COLUMN IF NOT EXISTS "last_api_error" TEXT;

ALTER TABLE "tiktok_integration_conversions"
  ALTER COLUMN "conversation_id" DROP NOT NULL;

ALTER TABLE "tiktok_integration_conversions"
  ALTER COLUMN "whatsapp_phone" DROP NOT NULL;

ALTER TABLE "tiktok_integration_conversions"
  ALTER COLUMN "first_message_at" DROP NOT NULL;

ALTER TABLE "tiktok_integration_conversions"
  ADD COLUMN IF NOT EXISTS "order_id" TEXT,
  ADD COLUMN IF NOT EXISTS "value_amount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "currency" TEXT;

-- Drop old uniqueness constraints (names may vary; ignore missing)
DO $$ BEGIN
  ALTER TABLE "tiktok_integration_conversions" DROP CONSTRAINT IF EXISTS "tiktok_integration_conversions_conversation_id_key";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tiktok_integration_conversions" DROP CONSTRAINT IF EXISTS "tiktok_integration_conversions_lead_id_key";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_event_name_conversation_id_key"
  ON "tiktok_integration_conversions"("integration_id", "event_name", "conversation_id");

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_event_name_order_id_key"
  ON "tiktok_integration_conversions"("integration_id", "event_name", "order_id");

CREATE INDEX IF NOT EXISTS "tiktok_integration_conversions_integration_id_event_name_sent_at_idx"
  ON "tiktok_integration_conversions"("integration_id", "event_name", "sent_at");

CREATE TABLE IF NOT EXISTS "tiktok_integration_api_logs" (
  "id" TEXT NOT NULL,
  "integration_id" TEXT,
  "conversion_id" TEXT,
  "event_name" TEXT NOT NULL,
  "event_id" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "http_status" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "processing_ms" INTEGER,
  "request_payload" JSONB,
  "response_body" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tiktok_integration_api_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tiktok_integration_api_logs_integration_id_created_at_idx"
  ON "tiktok_integration_api_logs"("integration_id", "created_at");

CREATE INDEX IF NOT EXISTS "tiktok_integration_api_logs_conversion_id_attempt_idx"
  ON "tiktok_integration_api_logs"("conversion_id", "attempt");

DO $$ BEGIN
  ALTER TABLE "tiktok_integration_api_logs"
    ADD CONSTRAINT "tiktok_integration_api_logs_integration_id_fkey"
    FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tiktok_integration_api_logs"
    ADD CONSTRAINT "tiktok_integration_api_logs_conversion_id_fkey"
    FOREIGN KEY ("conversion_id") REFERENCES "tiktok_integration_conversions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
