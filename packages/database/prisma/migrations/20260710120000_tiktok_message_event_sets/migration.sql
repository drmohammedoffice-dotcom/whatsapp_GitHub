-- TikTok Message Event Sets + API logs
CREATE TABLE IF NOT EXISTS "tiktok_message_event_sets" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "advertiser_id" TEXT NOT NULL,
  "whatsapp_number" TEXT NOT NULL,
  "event_set_id" TEXT,
  "event_set_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tiktok_message_event_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_message_event_sets_workspace_id_advertiser_id_whatsapp_number_key"
  ON "tiktok_message_event_sets"("workspace_id", "advertiser_id", "whatsapp_number");
CREATE INDEX IF NOT EXISTS "tiktok_message_event_sets_workspace_id_idx"
  ON "tiktok_message_event_sets"("workspace_id");
CREATE INDEX IF NOT EXISTS "tiktok_message_event_sets_advertiser_id_idx"
  ON "tiktok_message_event_sets"("advertiser_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tiktok_message_event_sets_workspace_id_fkey'
  ) THEN
    ALTER TABLE "tiktok_message_event_sets"
      ADD CONSTRAINT "tiktok_message_event_sets_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tiktok_api_logs" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT,
  "endpoint" TEXT NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'POST',
  "request_body" JSONB,
  "response_body" JSONB,
  "advertiser_id" TEXT,
  "event_set_id" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "http_status" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tiktok_api_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tiktok_api_logs_workspace_id_idx" ON "tiktok_api_logs"("workspace_id");
CREATE INDEX IF NOT EXISTS "tiktok_api_logs_advertiser_id_idx" ON "tiktok_api_logs"("advertiser_id");
CREATE INDEX IF NOT EXISTS "tiktok_api_logs_created_at_idx" ON "tiktok_api_logs"("created_at");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tiktok_api_logs_workspace_id_fkey'
  ) THEN
    ALTER TABLE "tiktok_api_logs"
      ADD CONSTRAINT "tiktok_api_logs_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "tiktok_marketing_connections"
  ADD COLUMN IF NOT EXISTS "oauth_scope" TEXT,
  ADD COLUMN IF NOT EXISTS "permissions_granted_at" TIMESTAMP(3);

-- Migrate existing rows from legacy table when present
INSERT INTO "tiktok_message_event_sets" (
  "id", "workspace_id", "advertiser_id", "whatsapp_number",
  "event_set_id", "event_set_name", "status", "error_message", "created_at", "updated_at"
)
SELECT
  "id",
  "workspace_id",
  "advertiser_id",
  "whatsapp_number",
  "event_set_id",
  "event_set_name",
  CASE
    WHEN "status" = 'CONNECTED' AND "event_set_id" IS NOT NULL THEN 'CREATED'
    WHEN "status" = 'ERROR' THEN 'FAILED'
    ELSE 'PENDING'
  END,
  "message",
  "created_at",
  "updated_at"
FROM "tiktok_event_sets"
ON CONFLICT ("workspace_id", "advertiser_id", "whatsapp_number") DO NOTHING;
