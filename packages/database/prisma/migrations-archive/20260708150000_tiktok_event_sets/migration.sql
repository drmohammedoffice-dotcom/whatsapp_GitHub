-- TikTok Message Event Sets (Messaging Events API)
CREATE TABLE IF NOT EXISTS "tiktok_event_sets" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "advertiser_id" TEXT NOT NULL,
  "whatsapp_number" TEXT NOT NULL,
  "event_set_id" TEXT,
  "event_set_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tiktok_event_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tiktok_event_sets_workspace_id_advertiser_id_whatsapp_number_key"
  ON "tiktok_event_sets"("workspace_id", "advertiser_id", "whatsapp_number");
CREATE INDEX IF NOT EXISTS "tiktok_event_sets_workspace_id_idx"
  ON "tiktok_event_sets"("workspace_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tiktok_event_sets_workspace_id_fkey'
  ) THEN
    ALTER TABLE "tiktok_event_sets"
      ADD CONSTRAINT "tiktok_event_sets_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Link mappings to event sets
ALTER TABLE IF EXISTS "tiktok_whatsapp_mappings"
  ADD COLUMN IF NOT EXISTS "event_set_id" TEXT;
