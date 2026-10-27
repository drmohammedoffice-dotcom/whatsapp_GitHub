-- Per-platform AI training settings and media
CREATE TYPE "AiTrainingPlatform" AS ENUM ('WHATSAPP', 'TELEGRAM', 'META', 'TIKTOK');

ALTER TABLE "AiSettings" ADD COLUMN "platform" "AiTrainingPlatform" NOT NULL DEFAULT 'WHATSAPP';

ALTER TABLE "AiSettings" DROP CONSTRAINT IF EXISTS "AiSettings_teamId_key";

DROP INDEX IF EXISTS "AiSettings_teamId_key";

ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_teamId_platform_key" UNIQUE ("teamId", "platform");

ALTER TABLE "AiTrainingMedia" ADD COLUMN "platform" "AiTrainingPlatform" NOT NULL DEFAULT 'WHATSAPP';

CREATE INDEX "AiTrainingMedia_teamId_platform_createdAt_idx" ON "AiTrainingMedia"("teamId", "platform", "createdAt");

CREATE INDEX "AiTrainingMedia_teamId_platform_productName_idx" ON "AiTrainingMedia"("teamId", "platform", "productName");
