-- Allow multiple TikTok pixel integrations per user/team
DROP INDEX IF EXISTS "tiktok_integrations_user_id_team_id_key";
CREATE INDEX IF NOT EXISTS "tiktok_integrations_user_id_team_id_idx" ON "tiktok_integrations"("user_id", "team_id");
ALTER TABLE "tiktok_integrations" ADD COLUMN IF NOT EXISTS "name" TEXT;
