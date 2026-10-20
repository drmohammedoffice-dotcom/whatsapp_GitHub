ALTER TABLE "platform_assistant_messages"
  ADD COLUMN IF NOT EXISTS "media_type" TEXT,
  ADD COLUMN IF NOT EXISTS "media_url" TEXT,
  ADD COLUMN IF NOT EXISTS "media_mime" TEXT,
  ADD COLUMN IF NOT EXISTS "actions" JSONB;
