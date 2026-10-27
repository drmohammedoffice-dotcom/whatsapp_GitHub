-- Voice-note training clips for AI auto-replies.
ALTER TABLE "AiTrainingMedia"
  ADD COLUMN IF NOT EXISTS "isVoiceNote" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "AiTrainingMedia_teamId_platform_isVoiceNote_idx"
  ON "AiTrainingMedia"("teamId", "platform", "isVoiceNote");
