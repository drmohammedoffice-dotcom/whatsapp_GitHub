-- Phase 4: scenes, versions lineage, captions, continuity, admin model config (no API keys)

ALTER TABLE "CreativeGenerationJob" ADD COLUMN IF NOT EXISTS "sceneId" TEXT;

CREATE TABLE IF NOT EXISTS "CreativeVideoScene" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "role" TEXT,
    "script" TEXT,
    "imageAssetId" TEXT,
    "videoAssetId" TEXT,
    "voiceAssetId" TEXT,
    "musicTrackId" TEXT,
    "captions" JSONB,
    "transition" TEXT,
    "camera" TEXT,
    "modelProfileId" TEXT,
    "environment" TEXT,
    "visualInstructions" TEXT,
    "metadata" JSONB,
    "generationJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeVideoScene_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreativeVideoVersion" ADD COLUMN IF NOT EXISTS "editRequestId" TEXT;
ALTER TABLE "CreativeVideoVersion" ADD COLUMN IF NOT EXISTS "parentVersionId" TEXT;
ALTER TABLE "CreativeVideoVersion" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreativeVideoVersion" ADD COLUMN IF NOT EXISTS "snapshot" JSONB;

ALTER TABLE "CreativeMusicTrack" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "CreativeMusicTrack" ADD COLUMN IF NOT EXISTS "genre" TEXT;
ALTER TABLE "CreativeMusicTrack" ADD COLUMN IF NOT EXISTS "mood" TEXT;
ALTER TABLE "CreativeMusicTrack" ADD COLUMN IF NOT EXISTS "license" TEXT;
ALTER TABLE "CreativeMusicTrack" ADD COLUMN IF NOT EXISTS "attribution" TEXT;
ALTER TABLE "CreativeMusicTrack" ADD COLUMN IF NOT EXISTS "usageRestrictions" TEXT;
ALTER TABLE "CreativeMusicTrack" ADD COLUMN IF NOT EXISTS "licenseConfirmed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "CreativeContinuityProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productAppearance" TEXT,
    "modelProfileId" TEXT,
    "clothing" TEXT,
    "brandIdentity" TEXT,
    "visualStyle" TEXT,
    "colorPalette" TEXT,
    "lighting" TEXT,
    "environment" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeContinuityProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreativeCaptionTrack" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "cues" JSONB NOT NULL,
    "style" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeCaptionTrack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreativeStudioModelConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "maxResolution" TEXT,
    "maxDurationSec" INTEGER,
    "qualityScore" DOUBLE PRECISION,
    "estimatedCostUsd" DOUBLE PRECISION,
    "capabilities" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeStudioModelConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreativeStudioSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "defaultImageModel" TEXT,
    "defaultVideoModel" TEXT,
    "featureFlags" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreativeStudioSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreativeContinuityProfile_projectId_key" ON "CreativeContinuityProfile"("projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreativeStudioModelConfig_provider_modelId_mediaType_key" ON "CreativeStudioModelConfig"("provider", "modelId", "mediaType");
CREATE INDEX IF NOT EXISTS "CreativeVideoScene_teamId_projectId_order_idx" ON "CreativeVideoScene"("teamId", "projectId", "order");
CREATE INDEX IF NOT EXISTS "CreativeCaptionTrack_teamId_projectId_idx" ON "CreativeCaptionTrack"("teamId", "projectId");
CREATE INDEX IF NOT EXISTS "CreativeStudioModelConfig_mediaType_enabled_priority_idx" ON "CreativeStudioModelConfig"("mediaType", "enabled", "priority");
CREATE INDEX IF NOT EXISTS "CreativeVideoVersion_teamId_projectId_isCurrent_idx" ON "CreativeVideoVersion"("teamId", "projectId", "isCurrent");
CREATE INDEX IF NOT EXISTS "CreativeVideoVersion_parentVersionId_idx" ON "CreativeVideoVersion"("parentVersionId");
CREATE INDEX IF NOT EXISTS "CreativeGenerationJob_sceneId_idx" ON "CreativeGenerationJob"("sceneId");
CREATE INDEX IF NOT EXISTS "CreativeContinuityProfile_teamId_idx" ON "CreativeContinuityProfile"("teamId");

ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "CreativeMusicTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "CreativeVideoScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "CreativeVideoVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreativeContinuityProfile" ADD CONSTRAINT "CreativeContinuityProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeContinuityProfile" ADD CONSTRAINT "CreativeContinuityProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeContinuityProfile" ADD CONSTRAINT "CreativeContinuityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "CreativeVideoScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
